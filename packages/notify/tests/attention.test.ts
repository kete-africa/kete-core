import { inOrganization, type SqlExecutor } from '@kete/tenancy';
import { createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  attend,
  attentionMigrationSql,
  attentionOrganizationsWaiting,
  DEFAULT_ATTENTION,
  markRead,
  memoryPushSender,
  notificationsMigrationSql,
  planAttention,
  quietUntil,
  ringPostponed,
  savePushSubscription,
  unreadCount,
  type AttentionPrefs,
} from '../src/index.js';

// Spec 151 (doctrine D-062, R14): one attention model decides who is told, of what, on which
// channel, once — her list always; her devices and phone at once when urgent, after her quiet
// hours when she must act; what she only needs to know waits in her list and her summary.

const ORG = 'org_attention';
let db: TestSchema;
const as = <T>(work: (client: SqlExecutor) => Promise<T>) => inOrganization(db.app, ORG, work);

/** Awa in Lomé (UTC), quiet from 22:00 to 07:00, WhatsApp chosen, a summary each evening. */
const awa: AttentionPrefs = {
  quietHours: { from: '22:00', to: '07:00' },
  timeZone: 'Africa/Lome',
  channels: ['email', 'whatsapp'],
  digest: 'daily',
};
const at = (iso: string) => new Date(iso);

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(notificationsMigrationSql({ schema, appRole }));
      await owner.query(attentionMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db?.drop();
});

describe('the plan of a signal', () => {
  it('rings what is urgent at any hour, on her devices and her phone', () => {
    expect(planAttention('urgent', awa, at('2026-10-23T23:30:00Z'))).toEqual({
      list: true,
      devices: { at: 'now' },
      phone: { at: 'now' },
      digest: false,
    });
  });

  it('holds what asks her to act until her quiet hours end', () => {
    expect(planAttention('act', awa, at('2026-10-23T23:30:00Z'))).toEqual({
      list: true,
      devices: { at: 'later', after: at('2026-10-24T07:00:00Z') },
      phone: { at: 'later', after: at('2026-10-24T07:00:00Z') },
      digest: false,
    });
    expect(planAttention('act', awa, at('2026-10-23T09:15:00Z')).devices).toEqual({ at: 'now' });
  });

  it('keeps what she only needs to know in her list, and her summary when she chose one', () => {
    expect(planAttention('know', awa, at('2026-10-23T09:15:00Z'))).toEqual({
      list: true,
      devices: { at: 'never' },
      phone: { at: 'never' },
      digest: true,
    });
    expect(planAttention('know', DEFAULT_ATTENTION).digest).toBe(false);
  });

  it('reaches her phone only when she chose WhatsApp or Telegram', () => {
    expect(planAttention('urgent', { ...awa, channels: ['email'] }).phone).toEqual({ at: 'never' });
  });

  it('reads her quiet hours at her own hour', () => {
    // 20:30 UTC is 23:30 in Nairobi: quiet until 07:00 there, 04:00 UTC.
    const nairobi = { ...awa, timeZone: 'Africa/Nairobi' };
    expect(quietUntil(nairobi, at('2026-10-23T20:30:00Z'))).toEqual(at('2026-10-24T04:00:00Z'));
    expect(quietUntil(awa, at('2026-10-23T20:30:00Z'))).toBeNull();
    // Within the same day: from 12:00 to 14:00.
    const lunch = { ...awa, quietHours: { from: '12:00', to: '14:00' } };
    expect(quietUntil(lunch, at('2026-10-23T12:45:00Z'))).toEqual(at('2026-10-23T14:00:00Z'));
  });
});

const phone = { endpoint: 'https://push.example/awa', keys: { p256dh: 'p', auth: 'a' } };
const signal = (key: string, weight: 'urgent' | 'act' | 'know') => ({
  organizationId: ORG,
  userId: 'usr_awa',
  kind: 'decision.waiting',
  title: 'Achat de 12 batteries : votre décision est attendue',
  href: '/a-faire',
  key,
  weight,
});

describe('a signal told once', () => {
  it('is kept once in her list, however many times it is raised', async () => {
    const push = memoryPushSender();
    await as(async (client) => {
      await savePushSubscription(client, { organizationId: ORG, userId: 'usr_awa' }, phone);
      const first = await attend(client, signal('drq_1:waiting', 'act'), {
        prefs: awa,
        push,
        now: at('2026-10-23T09:15:00Z'),
      });
      expect(first).toMatchObject({ told: true, pushed: 1 });
      const again = await attend(client, signal('drq_1:waiting', 'act'), { prefs: awa, push });
      expect(again).toMatchObject({ told: false, notificationId: null, pushed: 0 });
      expect(await unreadCount(client, 'usr_awa')).toBe(1);
    });
    expect(push.sent).toHaveLength(1);
  });

  it('rings her devices once her quiet hours end — unless she read it meanwhile', async () => {
    const push = memoryPushSender();
    const night = at('2026-10-23T23:30:00Z');
    await as(async (client) => {
      const held = await attend(client, signal('drq_2:waiting', 'act'), {
        prefs: awa,
        push,
        now: night,
      });
      expect(held).toMatchObject({ told: true, pushed: 0 });
      const read = await attend(client, signal('drq_3:waiting', 'act'), {
        prefs: awa,
        push,
        now: night,
      });
      await markRead(client, 'usr_awa', [read.notificationId ?? '']);
      expect(await ringPostponed(client, push, at('2026-10-24T06:59:00Z'))).toBe(0);
    });
    expect(push.sent).toHaveLength(0);
    // The worker's round, past 07:00: which organization, then its devices.
    await as((client) =>
      client.query(
        `update kete_attention set devices_after = now() - interval '1 minute'
        where devices_after is not null and rung_at is null`,
      ),
    );
    expect(await attentionOrganizationsWaiting(db.app)).toEqual([ORG]);
    expect(await as((client) => ringPostponed(client, push))).toBe(1);
    expect(push.sent.map((s) => s.message.title)).toEqual([
      'Achat de 12 batteries : votre décision est attendue',
    ]);
    expect(await attentionOrganizationsWaiting(db.app)).toEqual([]);
    expect(await as((client) => ringPostponed(client, push))).toBe(0);
  });

  it('never rings what she only needs to know', async () => {
    const push = memoryPushSender();
    await as((client) =>
      attend(client, signal('rpt_1:ready', 'know'), {
        prefs: awa,
        push,
        now: at('2026-10-23T09:15:00Z'),
      }),
    );
    expect(push.sent).toHaveLength(0);
  });
});
