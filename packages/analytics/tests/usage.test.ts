import { createEmitter, outboxMigrationSql, type Manifest } from '@kete/sdk';
import { inOrganization, type SqlExecutor } from '@kete/tenancy';
import { createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  dailyCounters,
  dayPeriod,
  organizationsWithUsage,
  pruneUsage,
  recordDailyUsage,
  trackUsage,
  usageByFeature,
  usageByPerson,
  usageMigrationSql,
} from '../src/index.js';

// Spec 091: who uses what, per organization, in the app's own Postgres; Kete Cockpit gets daily
// counts, never a person.

let db: TestSchema;
const as = <T>(organizationId: string, work: (client: SqlExecutor) => Promise<T>) =>
  inOrganization(db.app, organizationId, work);
const BLEU = 'org_bleu_001';
const VERT = 'org_vert_002';
const today = new Date().toISOString().slice(0, 10);
const manifest: Manifest = {
  product: 'prd_nettio',
  name: 'Nettio',
  version: '1.0.0',
  environment: 'development',
  events: ['metrics.daily'],
};
const ama = { kind: 'person' as const, id: 'usr_ama' };
const kofi = { kind: 'person' as const, id: 'usr_kofi' };
const agent = { kind: 'agent' as const, id: 'agt_ask' };

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole, ownerRole }) => {
      await owner.query(usageMigrationSql({ schema, appRole }));
      await owner.query(outboxMigrationSql({ schema, appRole, ownerRole }));
    },
  });
  await as(BLEU, async (client) => {
    await trackUsage(client, BLEU, {
      name: 'deposits.create',
      actor: ama,
      properties: { pieces: 3 },
    });
    await trackUsage(client, BLEU, { name: 'deposits.create', actor: kofi });
    await trackUsage(client, BLEU, { name: 'deposits.create', actor: ama, surface: 'whatsapp' });
    await trackUsage(client, BLEU, { name: 'assistant.ask', actor: agent, surface: 'chat' });
  });
  await as(VERT, (client) => trackUsage(client, VERT, { name: 'till.close', actor: kofi }));
});

afterAll(async () => {
  await db?.drop();
});

describe('usage of an organization', () => {
  it('says what was used, by how many people and agents', async () => {
    const period = dayPeriod(today);
    expect(await as(BLEU, (client) => usageByFeature(client, period))).toEqual([
      { name: 'deposits.create', events: 3, people: 2, agents: 0 },
      { name: 'assistant.ask', events: 1, people: 0, agents: 1 },
    ]);
    expect(await as(BLEU, (client) => usageByPerson(client, period))).toMatchObject([
      { personId: 'usr_ama', events: 2, features: 1 },
      { personId: 'usr_kofi', events: 1, features: 1 },
    ]);
  });

  it('is nobody else’s: another organization reads only its own', async () => {
    expect(await as(VERT, (client) => usageByFeature(client, dayPeriod(today)))).toEqual([
      { name: 'till.close', events: 1, people: 1, agents: 0 },
    ]);
    const { rows } = await db.app.query(`select event_id from kete_usage_events`);
    expect(rows).toEqual([]);
  });

  it('keeps no words of a person, nor her contact', async () => {
    await as(BLEU, async (client) => {
      const customer = (properties: Record<string, string>) =>
        trackUsage(client, BLEU, { name: 'customers.create', actor: ama, properties });
      await expect(customer({ email: 'ama@example.test' })).rejects.toMatchObject({
        code: 'personal_data',
      });
      await expect(customer({ who: '+228 90 11 22 33' })).rejects.toMatchObject({
        code: 'personal_data',
      });
      await expect(customer({ note: 'x'.repeat(81) })).rejects.toMatchObject({
        code: 'invalid_property',
      });
      await expect(
        trackUsage(client, BLEU, { name: 'Créer un client', actor: ama }),
      ).rejects.toMatchObject({ code: 'invalid_name' });
    });
  });
});

describe('what Kete Cockpit reads', () => {
  it('a day’s counts per organization, in the outbox to Cockpit, with no person in them', async () => {
    expect(await organizationsWithUsage(db.app, dayPeriod(today))).toEqual([BLEU, VERT]);
    const emitter = createEmitter(manifest);
    const counters = await as(BLEU, (client) => recordDailyUsage(client, emitter, BLEU, today));
    expect(counters).toEqual({
      usage_events: 4,
      usage_people: 2,
      usage_agents: 1,
      use_deposits_create: 3,
      use_assistant_ask: 1,
    });
    const { rows } = await db.owner.query<{
      organization_id: string;
      envelope: Record<string, unknown>;
    }>(`select organization_id, envelope from kete_outbox`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.organization_id).toBe(BLEU);
    expect(rows[0]?.envelope).toMatchObject({
      type: 'metrics.daily',
      product: 'prd_nettio',
      organization: BLEU,
      data: { day: today, counters },
    });
    expect(JSON.stringify(rows[0]?.envelope)).not.toMatch(/usr_|agt_/);
  });

  it('records nothing for a day without use', async () => {
    const emitter = createEmitter(manifest);
    expect(
      await as(BLEU, (client) => recordDailyUsage(client, emitter, BLEU, '2020-01-01')),
    ).toBeNull();
    expect(await as(BLEU, (client) => dailyCounters(client, '2020-01-01'))).toMatchObject({
      usage_events: 0,
    });
  });
});

describe('retention', () => {
  it('forgets what is older than its retention, and keeps the rest', async () => {
    await db.owner.query(
      `update kete_usage_events set at = now() - interval '500 days' where name = 'assistant.ask'`,
    );
    expect(await as(BLEU, (client) => pruneUsage(client))).toBe(1);
    expect(await as(BLEU, (client) => usageByFeature(client, dayPeriod(today)))).toHaveLength(1);
  });
});
