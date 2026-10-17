import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  organizationLayer,
  personLayer,
  personOfToken,
  savePreference,
  SettingsApiError,
} from '@/features/settings/layers';
import { saveSettings } from '@/features/settings/settings';
import { auth } from '@/platform/auth';
import { getPool } from '@/platform/db';

// Spec 115 (FR-005): the Compte Kete's two layers of Kete's settings, read by an app with the
// person's token; her preferences saved here follow her in every app.

const run = randomBytes(4).toString('hex');
const BASE = process.env.BETTER_AUTH_URL ?? 'http://localhost:3100';
const owner = new pg.Pool({ connectionString: process.env.ACCOUNT_TEST_OWNER_URL, max: 1 });
const api = auth.api as unknown as {
  signUpEmail(input: {
    body: { name: string; email: string; password: string };
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: { user: { id: string } } }>;
  createOrganization(input: { body: { name: string; slug: string }; headers: Headers }): Promise<{
    id: string;
  }>;
  signJWT(input: { body: { payload: Record<string, unknown> } }): Promise<{ token: string }>;
};

let userId = '';
let organization = '';

const tokenOf = async (extra: Record<string, unknown> = {}) =>
  (
    await api.signJWT({
      body: {
        payload: {
          sub: userId,
          email: `afi.${run}@example.test`,
          name: 'Afi',
          org: organization,
          role: 'owner',
          aud: 'urn:kete:apps',
          ...extra,
        },
      },
    })
  ).token;
const request = (token: string) =>
  new Request(`${BASE}/api/apps/settings`, { headers: { authorization: `Bearer ${token}` } });

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    return error instanceof SettingsApiError ? `${error.status} ${error.code}` : String(error);
  }
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
  const cookie = new Headers({
    cookie: signUp.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; '),
  });
  organization = (
    await api.createOrganization({
      body: { name: `Pressing ${run}`, slug: `pressing-settings-${run}` },
      headers: cookie,
    })
  ).id;
});

afterAll(async () => {
  await owner.query('delete from organization where id = $1', [organization]);
  await owner.query('delete from "user" where id = $1', [userId]);
  await owner.end();
  await getPool().end();
});

describe('the Compte Kete’s layers of settings', () => {
  it('are read with the person’s token: her organization’s settings and her preferences', async () => {
    const identity = await personOfToken(request(await tokenOf()));
    expect(identity).toMatchObject({ userId, organizationId: organization });
    expect(await organizationLayer(organization)).toEqual({});
    await saveSettings({ userId, organizationId: organization, role: 'owner' } as never, {
      companyName: 'Pressing Démo',
      locale: 'fr',
      timeZone: 'Africa/Lome',
      currency: 'XOF',
      notificationChannels: ['whatsapp'],
      nif: '1000123456',
    });
    expect(await organizationLayer(organization)).toMatchObject({
      'kete.company_name': 'Pressing Démo',
      'kete.currency': 'XOF',
      'kete.notification_channels': ['whatsapp'],
      'kete.legal_ids': { nif: '1000123456' },
    });
  });

  it('save her preference, checked, taken back with null — never by her agent', async () => {
    const identity = await personOfToken(request(await tokenOf()));
    expect(await savePreference(identity, { key: 'kete.theme', value: 'dark' })).toEqual({
      'kete.theme': 'dark',
    });
    await savePreference(identity, { key: 'kete.locale', value: 'en' });
    expect(await personLayer(userId)).toEqual({ 'kete.theme': 'dark', 'kete.locale': 'en' });
    expect(await refusal(savePreference(identity, { key: 'kete.theme', value: 'pink' }))).toBe(
      '422 invalid_value',
    );
    // The currency is no person's setting.
    expect(await refusal(savePreference(identity, { key: 'kete.currency', value: 'EUR' }))).toBe(
      '422 layer_not_allowed',
    );
    await savePreference(identity, { key: 'kete.locale', value: null });
    expect(await personLayer(userId)).toEqual({ 'kete.theme': 'dark' });
    expect(
      await refusal(
        savePreference({ ...identity, actingAgent: { id: 'agt_assistant' } } as never, {
          key: 'kete.theme',
          value: 'light',
        }),
      ),
    ).toBe('403 not_yours');
  });

  it('refuse no token, a foreign token, and a token without an organization', async () => {
    expect(await refusal(personOfToken(new Request(`${BASE}/api/apps/settings`)))).toBe(
      '401 unauthenticated',
    );
    expect(await refusal(personOfToken(request('not-a-token')))).toBe('401 invalid_token');
  });
});
