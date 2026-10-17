import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deploy,
  DeploymentError,
  deploymentOf,
  deployRegions,
  type DeployInput,
} from '@/features/deployments/deployments';
import type { Actor } from '@/platform/actor';
import { auth } from '@/platform/auth';
import { getPool } from '@/platform/db';

// Spec 123 (phase 11, step B3): an organization deploys its Kete Enterprise itself — shared and
// ready at once with no gesture of Kete's, or another mode requested from Kete's fleet.

const run = randomBytes(4).toString('hex');
const owner = new pg.Pool({ connectionString: process.env.ACCOUNT_TEST_OWNER_URL, max: 1 });
const api = auth.api as unknown as {
  signUpEmail(input: {
    body: { name: string; email: string; password: string };
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: { user: { id: string } } }>;
  createOrganization(input: { body: { name: string; slug: string }; headers: Headers }): Promise<{
    id: string;
  }>;
};

const env = {
  KETE_ENTERPRISE_URL: 'https://enterprise.kete.test/',
  KETE_DEPLOY_REGIONS: JSON.stringify([
    { id: 'west-africa', label: { fr: 'Afrique de l’Ouest', en: 'West Africa' } },
    { id: 'europe', label: { fr: 'Europe', en: 'Europe' } },
  ]),
};

let userId = '';
const orgs = { kya: '', pressing: '' };
const as = (organizationId: string, role: Actor['role'] = 'owner') =>
  ({ userId, email: `afi.${run}@example.test`, organizationId, role }) as unknown as Actor;

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    return error instanceof DeploymentError ? error.code : (error as Error).message;
  }
}

async function eventsOf(organizationId: string) {
  const { rows } = await owner.query<{ envelope: { type: string; data: Record<string, unknown> } }>(
    'select envelope from kete_outbox where organization_id = $1 order by created_at',
    [organizationId],
  );
  return rows.map((r) => r.envelope).filter((e) => e.type.startsWith('deployment.'));
}

beforeAll(async () => {
  const signUp = await api.signUpEmail({
    body: {
      name: 'Afi',
      email: `afi.${run}@example.test`,
      password: `pw-${randomBytes(9).toString('hex')}`,
    },
    returnHeaders: true,
  });
  userId = signUp.response.user.id;
  const headers = new Headers({
    cookie: signUp.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; '),
  });
  orgs.kya = (
    await api.createOrganization({ body: { name: `KYA ${run}`, slug: `kya-${run}` }, headers })
  ).id;
  orgs.pressing = (
    await api.createOrganization({
      body: { name: `Pressing ${run}`, slug: `pressing-dpl-${run}` },
      headers,
    })
  ).id;
});

afterAll(async () => {
  await owner.query('delete from organization where id = any($1)', [Object.values(orgs)]);
  await owner.query('delete from "user" where id = $1', [userId]);
  await owner.end();
  await getPool().end();
});

describe('an organization deploys its Kete Enterprise itself', () => {
  const shared: DeployInput = { mode: 'shared', region: 'west-africa', apps: ['prd_kete_finance'] };

  it('reads the regions Kete offers, its own region without any', () => {
    expect(deployRegions(env).map((r) => r.id)).toEqual(['west-africa', 'europe']);
    expect(deployRegions({}).map((r) => r.id)).toEqual(['kete']);
    expect(deployRegions({ KETE_DEPLOY_REGIONS: 'not json' }).map((r) => r.id)).toEqual(['kete']);
  });

  it('finds it ready at once in shared mode, with no gesture of Kete’s, and says so', async () => {
    expect(await refusal(deploy(as(orgs.kya, 'member'), shared, env))).toBe('forbidden');
    const deployment = await deploy(as(orgs.kya), shared, env);
    expect(deployment).toMatchObject({
      mode: 'shared',
      status: 'ready',
      url: 'https://enterprise.kete.test',
      apps: ['prd_kete_finance'],
      requestedMode: null,
    });
    expect(await deploymentOf(orgs.kya)).toMatchObject({ id: deployment.id, status: 'ready' });
    expect(await eventsOf(orgs.kya)).toEqual([
      expect.objectContaining({
        type: 'deployment.requested',
        data: {
          deployment_id: deployment.id,
          product: 'prd_kete_enterprise',
          mode: 'shared',
          region: 'west-africa',
          apps: ['prd_kete_finance'],
        },
      }),
      expect.objectContaining({
        type: 'deployment.ready',
        data: {
          deployment_id: deployment.id,
          product: 'prd_kete_enterprise',
          mode: 'shared',
          url: 'https://enterprise.kete.test',
        },
      }),
    ]);
  });

  it('asks another mode beside the running one, once', async () => {
    expect(await refusal(deploy(as(orgs.kya), shared, env))).toBe('same_mode');
    const moving = await deploy(as(orgs.kya), { mode: 'dedicated', region: 'europe' }, env);
    expect(moving).toMatchObject({ mode: 'shared', status: 'ready', requestedMode: 'dedicated' });
    expect((await eventsOf(orgs.kya)).at(-1)).toMatchObject({
      type: 'deployment.requested',
      data: { mode: 'dedicated', region: 'europe' },
    });
    expect(
      await refusal(deploy(as(orgs.kya), { mode: 'on_premises', region: 'europe' }, env)),
    ).toBe('already_requested');
  });

  it('records a request in another mode for Kete’s fleet; refuses what cannot be', async () => {
    // Without a shared instance configured, shared mode is not offered.
    const noShared = { KETE_DEPLOY_REGIONS: env.KETE_DEPLOY_REGIONS };
    expect(await refusal(deploy(as(orgs.pressing), shared, noShared))).toBe('shared_unavailable');
    expect(
      await refusal(deploy(as(orgs.pressing), { mode: 'dedicated', region: 'mars' }, env)),
    ).toBe('unknown_region');
    const request = await deploy(as(orgs.pressing), { mode: 'autonomous', region: 'europe' }, env);
    expect(request).toMatchObject({ mode: 'autonomous', status: 'requested', url: null });
    expect(await refusal(deploy(as(orgs.pressing), shared, env))).toBe('already_requested');
    expect((await eventsOf(orgs.pressing)).map((e) => e.type)).toEqual(['deployment.requested']);
  });

  it('keeps each organization to its own deployment', async () => {
    const seen = await getPool().connect();
    try {
      await seen.query('begin');
      await seen.query(`select set_config('kete.organization_id', $1, true)`, [orgs.pressing]);
      const { rows } = await seen.query<{ organization_id: string }>(
        'select organization_id from deployments',
      );
      await seen.query('rollback');
      expect(rows.map((r) => r.organization_id)).toEqual([orgs.pressing]);
    } finally {
      seen.release();
    }
  });
});
