import { randomBytes } from 'node:crypto';
import { readJournal } from '@kete/commands';
import { inOrganizationTx, sqlExecutorOf } from '@kete/tenancy/drizzle';
import { eq, inArray } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OperatorGesture } from '@/features/admin/offers';
import { deploy, deploymentOf } from '@/features/deployments/deployments';
import { FleetError, makeReady, readFleet } from '@/features/deployments/fleet';
import type { Actor } from '@/platform/actor';
import { db, getPool } from '@/platform/db';
import { organization, user } from '@/platform/schema';

// Spec 125 (phase 11, step B2): Kete's fleet reads every organization's deployment requests, and
// an operator says one is made — its client sees it ready, and hears it.

const run = randomBytes(4).toString('hex');
const operators = `org_ops_fleet_${run}`;
const kya = `org_kya_fleet_${run}`;
const pressing = `org_pressing_fleet_${run}`;
const person = `usr_fleet_${run}`;
const owner = new pg.Pool({ connectionString: process.env.ACCOUNT_TEST_OWNER_URL, max: 1 });
const env = {
  KETE_ENTERPRISE_URL: 'https://enterprise.kete.test',
  KETE_DEPLOY_REGIONS: JSON.stringify([{ id: 'europe', label: { fr: 'Europe', en: 'Europe' } }]),
};
const as = (organizationId: string) =>
  ({ userId: person, organizationId, role: 'owner' }) as unknown as Actor;
let key = 0;
const gesture = (): OperatorGesture =>
  ({
    identity: { userId: 'usr_operator', organizationId: operators, role: 'owner', twoFactor: true },
    idempotencyKey: `fleet-${run}-${++key}`,
  }) as unknown as OperatorGesture;

async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    return error instanceof FleetError ? `${error.status} ${error.code}` : (error as Error).message;
  }
}

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values({
    id: person,
    name: 'Afi',
    email: `fleet.${run}@example.test`,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values([
    { id: operators, name: 'Kete', slug: `ops-fleet-${run}`, createdAt: now },
    { id: kya, name: `KYA ${run}`, slug: `kya-fleet-${run}`, createdAt: now },
    { id: pressing, name: `Pressing ${run}`, slug: `pressing-fleet-${run}`, createdAt: now },
  ]);
});

afterAll(async () => {
  await owner.query('delete from kete_commands where organization_id = $1', [operators]);
  await db.delete(organization).where(inArray(organization.id, [operators, kya, pressing]));
  await db.delete(user).where(eq(user.id, person));
  await owner.end();
  await getPool().end();
});

describe('Kete’s fleet', () => {
  let dedicated = '';
  let shared = '';

  it('reads every organization’s deployments, what waits for Kete first', async () => {
    dedicated = (await deploy(as(kya), { mode: 'dedicated', region: 'europe' }, env)).id;
    shared = (await deploy(as(pressing), { mode: 'shared', region: 'europe' }, env)).id;
    const fleet = (await readFleet()).filter((d) => d.id === dedicated || d.id === shared);
    expect(fleet.map((d) => [d.organizationName, d.mode, d.status])).toEqual([
      [`KYA ${run}`, 'dedicated', 'requested'],
      [`Pressing ${run}`, 'shared', 'ready'],
    ]);
  });

  it('says a request is made: its client finds it ready, hears it, and Kete journals it', async () => {
    const made = await makeReady(
      { deploymentId: dedicated, url: 'https://kya.kete.software' },
      gesture(),
    );
    expect(made).toEqual({
      deploymentId: dedicated,
      organizationId: kya,
      mode: 'dedicated',
      url: 'https://kya.kete.software',
    });
    expect(await deploymentOf(kya)).toMatchObject({
      status: 'ready',
      url: 'https://kya.kete.software',
    });
    const { rows } = await owner.query<{ envelope: { type: string; data: object } }>(
      `select envelope from kete_outbox where organization_id = $1 and envelope->>'type' = 'deployment.ready'`,
      [kya],
    );
    expect(rows.map((r) => r.envelope.data)).toEqual([
      {
        deployment_id: dedicated,
        product: 'prd_kete_enterprise',
        mode: 'dedicated',
        url: 'https://kya.kete.software',
      },
    ]);
    const journal = await inOrganizationTx(db, operators, (tx) =>
      readJournal(sqlExecutorOf(tx), { limit: 10 }),
    );
    expect(journal.map((entry) => entry.name)).toContain('make-deployment-ready');
    expect(
      await refusal(makeReady({ deploymentId: dedicated, url: 'https://x.test' }, gesture())),
    ).toBe('409 nothing_to_make');
  });

  it('moves a running one to the mode its organization asked', async () => {
    await deploy(as(pressing), { mode: 'dedicated', region: 'europe' }, env);
    await makeReady({ deploymentId: shared, url: 'https://pressing.kete.software' }, gesture());
    expect(await deploymentOf(pressing)).toMatchObject({
      mode: 'dedicated',
      status: 'ready',
      url: 'https://pressing.kete.software',
      requestedMode: null,
    });
  });

  it('refuses what is not there, and an address that is not https', async () => {
    expect(
      await refusal(makeReady({ deploymentId: 'dpl_none', url: 'https://x.test' }, gesture())),
    ).toBe('404 not_found');
    await expect(
      makeReady({ deploymentId: dedicated, url: 'http://insecure.test' }, gesture()),
    ).rejects.toThrow();
  });
});
