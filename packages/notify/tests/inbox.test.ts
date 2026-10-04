import { inOrganization } from '@kete/tenancy';
import { createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  generatePushKeys,
  listNotifications,
  markRead,
  memoryPushSender,
  notificationsMigrationSql,
  notify,
  pushSenderFromEnv,
  pushSubscriptionsOf,
  savePushSubscription,
  unreadCount,
} from '../src/index.js';

// Spec 055: a person's notifications in the product, read or not, and on her devices by Web Push.

let db: TestSchema;
const as = <T>(organizationId: string, fn: Parameters<typeof inOrganization<T>>[2]) =>
  inOrganization(db.app, organizationId, fn);

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(notificationsMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db?.drop();
});

const phone = { endpoint: 'https://push.example/phone', keys: { p256dh: 'p', auth: 'a' } };
const laptop = { endpoint: 'https://push.example/laptop', keys: { p256dh: 'p', auth: 'a' } };

describe('notifications', () => {
  it('keeps a notification for its person, and tells her devices', async () => {
    const push = memoryPushSender();
    await as('org_kya', async (client) => {
      await savePushSubscription(client, { organizationId: 'org_kya', userId: 'usr_kofi' }, phone);
      const { pushed } = await notify(
        client,
        {
          organizationId: 'org_kya',
          userId: 'usr_kofi',
          kind: 'decision.waiting',
          title: 'Achat de 12 batteries : votre avis est attendu',
          href: '/a-faire',
        },
        push,
      );
      expect(pushed).toBe(1);
      expect(await unreadCount(client, 'usr_kofi')).toBe(1);
      expect(await unreadCount(client, 'usr_esi')).toBe(0);
    });
    expect(push.sent).toEqual([
      {
        endpoint: phone.endpoint,
        message: {
          title: 'Achat de 12 batteries : votre avis est attendu',
          body: '',
          href: '/a-faire',
          tag: 'decision.waiting',
        },
      },
    ]);
  });

  it('forgets a device the push service no longer knows', async () => {
    const push = memoryPushSender([laptop.endpoint]);
    await as('org_kya', async (client) => {
      await savePushSubscription(client, { organizationId: 'org_kya', userId: 'usr_kofi' }, laptop);
      await notify(
        client,
        {
          organizationId: 'org_kya',
          userId: 'usr_kofi',
          kind: 'schedule.answered',
          title: 'Votre tâche a répondu',
        },
        push,
      );
      expect((await pushSubscriptionsOf(client, 'usr_kofi')).map((d) => d.endpoint)).toEqual([
        phone.endpoint,
      ]);
    });
  });

  it('marks read some or all, and keeps each organization alone', async () => {
    await as('org_kya', async (client) => {
      const [latest] = await listNotifications(client, 'usr_kofi');
      expect(await markRead(client, 'usr_kofi', [latest?.notificationId ?? ''])).toBe(1);
      expect(await unreadCount(client, 'usr_kofi')).toBe(1);
      expect(await markRead(client, 'usr_esi', 'all')).toBe(0);
      expect(await markRead(client, 'usr_kofi', 'all')).toBe(1);
      expect((await listNotifications(client, 'usr_kofi', { unreadOnly: true })).length).toBe(0);
    });
    expect(await as('org_other', (client) => listNotifications(client, 'usr_kofi'))).toEqual([]);
  });

  it('reads its push keys from the environment, or stays in the product without them', () => {
    expect(pushSenderFromEnv({})).toBeNull();
    const keys = generatePushKeys();
    const sender = pushSenderFromEnv({
      KETE_VAPID_PUBLIC_KEY: keys.publicKey,
      KETE_VAPID_PRIVATE_KEY: keys.privateKey,
    });
    expect(sender?.publicKey).toBe(keys.publicKey);
  });
});
