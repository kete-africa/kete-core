import { inOrganization } from '@kete/tenancy';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  clearSetting,
  createAccountSettings,
  defineSettings,
  keteSettings,
  readLayers,
  resolve,
  setSetting,
  setting,
  settingHistory,
  settingsMigrationSql,
} from '../src/index.js';

// Spec 115: settings in layers, declared once, the most precise wins, every change journaled.

const nettio = [
  setting({
    key: 'prd_nettio.pickup_delay_hours',
    schema: z.number().int().min(1).max(720),
    default: 48,
    layers: ['organization', 'entity', 'app'],
    permission: 'nettio:settings',
    group: 'deposits',
    label: { fr: 'Délai de retrait', en: 'Pickup delay' },
  }),
];
const registry = defineSettings(keteSettings, nettio);

describe('declarations', () => {
  it('refuse a key declared twice, a default out of its schema, a secret, a layer that is none', () => {
    expect(() => defineSettings(nettio, nettio)).toThrow(/twice/);
    expect(() =>
      defineSettings([{ ...nettio[0], key: 'prd_nettio.bad', default: 0 } as never]),
    ).toThrow(/default/);
    expect(() =>
      defineSettings([{ ...nettio[0], key: 'prd_nettio.key', sensitivity: 'secret' } as never]),
    ).toThrow(/secret/);
    expect(() =>
      defineSettings([{ ...nettio[0], key: 'prd_nettio.xx', layers: ['kete'] } as never]),
    ).toThrow(/layer/);
    expect(() => defineSettings([{ ...nettio[0], key: 'Nettio.delay' } as never])).toThrow(/key/);
  });

  it('describe themselves as JSON Schema, for a manifest', () => {
    const delay = registry.describe().find((d) => d.key === 'prd_nettio.pickup_delay_hours');
    expect(delay).toMatchObject({
      default: 48,
      layers: ['organization', 'entity', 'app'],
      sensitivity: 'internal',
      schema: { type: 'integer', minimum: 1, maximum: 720 },
    });
  });
});

describe('resolution', () => {
  it('lets the most precise layer win, and says where each value comes from', () => {
    const resolved = resolve(registry, {
      organization: { 'kete.locale': 'fr', 'kete.currency': 'XOF', 'kete.theme': 'dark' },
      entity: { 'kete.currency': 'GHS' },
      person: { 'kete.locale': 'en', 'kete.theme': 'light' },
      device: { 'kete.theme': 'dark' },
    });
    expect(resolved.value('kete.locale')).toBe('en');
    expect(resolved.from('kete.locale')).toBe('person');
    expect(resolved.value('kete.currency')).toBe('GHS');
    expect(resolved.from('kete.currency')).toBe('entity');
    // The theme is no organization's setting: its value there is ignored.
    expect(resolved.value('kete.theme')).toBe('dark');
    expect(resolved.from('kete.theme')).toBe('device');
    expect(resolved.value('prd_nettio.pickup_delay_hours')).toBe(48);
    expect(resolved.from('prd_nettio.pickup_delay_hours')).toBe('kete');
  });

  it('skips a stored value that no longer fits its schema', () => {
    const resolved = resolve(registry, {
      organization: { 'kete.currency': 'francs' },
      app: { 'prd_nettio.pickup_delay_hours': 24 },
    });
    expect(resolved.value('kete.currency')).toBe('XOF');
    expect(resolved.from('kete.currency')).toBe('kete');
    expect(resolved.value('prd_nettio.pickup_delay_hours')).toBe(24);
  });
});

let db: TestSchema;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(settingsMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db?.drop();
});

describe('the layers a product keeps', () => {
  it('sets a value checked against its layer and schema, journals it, and takes it back', async () => {
    const org = 'org_pressing_demo';
    await inOrganization(db.app, org, async (tx) => {
      await expect(
        setSetting(tx, org, registry, {
          layer: 'app',
          key: 'kete.locale',
          value: 'en',
          by: 'usr_ama',
        }),
      ).rejects.toMatchObject({ code: 'layer_not_allowed' });
      await expect(
        setSetting(tx, org, registry, {
          layer: 'app',
          key: 'prd_nettio.pickup_delay_hours',
          value: 0,
          by: 'usr_ama',
        }),
      ).rejects.toMatchObject({ code: 'invalid_value' });
      await expect(
        setSetting(tx, org, registry, { layer: 'app', key: 'prd_x.nope', value: 1, by: 'usr_ama' }),
      ).rejects.toMatchObject({ code: 'unknown_setting' });

      const at = new Date('2026-10-17T09:00:00Z');
      await setSetting(
        tx,
        org,
        registry,
        { layer: 'app', key: 'prd_nettio.pickup_delay_hours', value: 72, by: 'usr_ama' },
        at,
      );
      await setSetting(
        tx,
        org,
        registry,
        {
          layer: 'entity',
          scopeId: 'unt_be',
          key: 'prd_nettio.pickup_delay_hours',
          value: 24,
          by: 'usr_ama',
        },
        new Date('2026-10-17T09:05:00Z'),
      );
      const layers = await readLayers(tx, { entityIds: ['unt_be'] });
      expect(layers).toEqual({
        app: { 'prd_nettio.pickup_delay_hours': 72 },
        entity: { 'prd_nettio.pickup_delay_hours': 24 },
      });
      // The site of Bè is more precise than the app: its own delay wins there.
      expect(resolve(registry, layers).value('prd_nettio.pickup_delay_hours')).toBe(24);

      expect(
        await clearSetting(
          tx,
          org,
          {
            layer: 'entity',
            scopeId: 'unt_be',
            key: 'prd_nettio.pickup_delay_hours',
            by: 'usr_ama',
          },
          new Date('2026-10-17T09:10:00Z'),
        ),
      ).toBe(true);
      expect(
        await clearSetting(tx, org, {
          layer: 'entity',
          scopeId: 'unt_be',
          key: 'prd_nettio.pickup_delay_hours',
          by: 'usr_ama',
        }),
      ).toBe(false);
      const history = await settingHistory(tx, 'prd_nettio.pickup_delay_hours');
      expect(history.map((h) => [h.layer, h.before, h.after])).toEqual([
        ['entity', 24, null],
        ['entity', null, 24],
        ['app', null, 72],
      ]);
    });
  });

  it('keeps each organization to its own settings', async () => {
    await assertOrganizationIsolation({
      app: db.app,
      table: 'kete_settings',
      organizations: ['org_iso_a', 'org_iso_b'],
      insert: async (tx, organizationId) => {
        await setSetting(tx, organizationId, registry, {
          layer: 'app',
          key: 'kete.currency',
          value: 'XOF',
          by: 'usr_ama',
        });
      },
    });
  });
});

describe('the Compte Kete’s layers, as an app reads them', () => {
  it('reads both layers with her token, keeps them five minutes, and saves a preference', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    let time = 0;
    const account = createAccountSettings({
      url: 'https://compte.test/',
      now: () => time,
      fetch: (async (url: string, init?: RequestInit) => {
        calls.push({ url, ...(init ? { init } : {}) });
        if (init?.method === 'PUT') return Response.json({ ok: true });
        return Response.json({
          organization: { 'kete.currency': 'XOF' },
          person: { 'kete.theme': 'dark' },
        });
      }) as unknown as typeof fetch,
    });
    expect(await account.read('token-a')).toEqual({
      organization: { 'kete.currency': 'XOF' },
      person: { 'kete.theme': 'dark' },
    });
    expect(calls[0]?.url).toBe('https://compte.test/api/apps/settings');
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe('Bearer token-a');
    time = 299_000;
    await account.read('token-a');
    expect(calls).toHaveLength(1);
    expect(await account.savePreference('token-a', 'kete.theme', 'light')).toEqual({ ok: true });
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ key: 'kete.theme', value: 'light' });
    // What she chose is read again at once.
    await account.read('token-a');
    expect(calls).toHaveLength(3);
  });

  it('falls back to nothing without a Compte Kete, a token or an answer', async () => {
    const alone = createAccountSettings({ url: '' });
    expect(alone.connected).toBe(false);
    expect(await alone.read('t')).toEqual({ organization: {}, person: {} });
    expect(await alone.savePreference('t', 'kete.theme', 'dark')).toEqual({
      ok: false,
      error: 'not_connected',
    });
    const down = createAccountSettings({
      url: 'https://compte.test',
      fetch: (async () => new Response('no', { status: 503 })) as unknown as typeof fetch,
    });
    expect(await down.read('t')).toEqual({ organization: {}, person: {} });
    expect(await down.read(null)).toEqual({ organization: {}, person: {} });
  });
});
