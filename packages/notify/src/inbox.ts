import { newId } from '@kete/records';
import { organizationPolicySql, type SqlExecutor } from '@kete/tenancy';
import type { PushSender } from './push.js';

// What a person is told inside the product (spec 055): her notifications, read or not, and the
// devices she asked to be told on (Web Push). A notification informs; what asks for an action
// lives in the product's own « To do ».

export interface NotificationsMigrationOptions {
  /** Default `public`. */
  schema?: string;
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;
const checked = (name: string) => {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
};

/** The notifications and push subscriptions, each with its row-level security. */
export function notificationsMigrationSql(options: NotificationsMigrationOptions): string {
  const s = checked(options.schema ?? 'public');
  const app = checked(options.appRole);
  const policy = (table: string) => organizationPolicySql({ schema: s, table, appRole: app });
  return `
create table ${s}.kete_notifications (
  organization_id text not null,
  notification_id text not null,
  user_id text not null,
  kind text not null check (kind ~ '^[a-z][a-z0-9_.-]{1,40}$'),
  title text not null check (length(title) between 1 and 200),
  body text check (length(body) <= 1000),
  href text check (href ~ '^(/|https://)'),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (organization_id, notification_id)
);
create index kete_notifications_user on ${s}.kete_notifications (organization_id, user_id, created_at desc);
${policy('kete_notifications')}
grant select, insert, update on ${s}.kete_notifications to ${app};

create table ${s}.kete_push_subscriptions (
  organization_id text not null,
  user_id text not null,
  endpoint text not null check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, endpoint)
);
create index kete_push_subscriptions_user on ${s}.kete_push_subscriptions (organization_id, user_id);
${policy('kete_push_subscriptions')}
grant select, insert, update, delete on ${s}.kete_push_subscriptions to ${app};
`;
}

export interface Notification {
  notificationId: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
  read: boolean;
}

export interface NotificationInput {
  organizationId: string;
  userId: string;
  /** What it is about: `decision.waiting`, `schedule.answered`… */
  kind: string;
  title: string;
  body?: string;
  /** Where it opens: a path of the product or an https address. */
  href?: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Tells a person: the notification is kept in her list, and sent to each device she subscribed
 * when a push sender is given. A device the push service no longer knows is forgotten.
 */
export async function notify(
  db: SqlExecutor,
  input: NotificationInput,
  push?: PushSender | null,
): Promise<{ notificationId: string; pushed: number }> {
  const notificationId = newId('ntf');
  await db.query(
    `insert into kete_notifications (organization_id, notification_id, user_id, kind, title, body, href)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.organizationId,
      notificationId,
      input.userId,
      input.kind,
      input.title.slice(0, 200),
      input.body?.slice(0, 1000) ?? null,
      input.href ?? null,
    ],
  );
  let pushed = 0;
  if (push) {
    for (const device of await pushSubscriptionsOf(db, input.userId)) {
      const outcome = await push
        .send(device, {
          title: input.title,
          body: input.body ?? '',
          href: input.href ?? '/',
          tag: input.kind,
        })
        .catch(() => 'failed' as const);
      if (outcome === 'sent') pushed += 1;
      if (outcome === 'gone') await removePushSubscription(db, input.userId, device.endpoint);
    }
  }
  return { notificationId, pushed };
}

export async function listNotifications(
  db: SqlExecutor,
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<Notification[]> {
  const { rows } = await db.query<{
    notification_id: string;
    kind: string;
    title: string;
    body: string | null;
    href: string | null;
    created_at: Date;
    read_at: Date | null;
  }>(
    `select notification_id, kind, title, body, href, created_at, read_at from kete_notifications
      where user_id = $1 ${options.unreadOnly ? 'and read_at is null' : ''}
      order by created_at desc limit $2`,
    [userId, Math.min(Math.max(options.limit ?? 30, 1), 100)],
  );
  return rows.map((r) => ({
    notificationId: r.notification_id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    href: r.href,
    createdAt: r.created_at.toISOString(),
    read: r.read_at !== null,
  }));
}

export async function unreadCount(db: SqlExecutor, userId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from kete_notifications where user_id = $1 and read_at is null`,
    [userId],
  );
  return rows[0]?.n ?? 0;
}

/** Marks some of her notifications read, or all of them. */
export async function markRead(
  db: SqlExecutor,
  userId: string,
  which: string[] | 'all',
): Promise<number> {
  const { rows } = await db.query<{ notification_id: string }>(
    which === 'all'
      ? `update kete_notifications set read_at = now() where user_id = $1 and read_at is null
         returning notification_id`
      : `update kete_notifications set read_at = now()
          where user_id = $1 and read_at is null and notification_id = any($2::text[])
         returning notification_id`,
    which === 'all' ? [userId] : [userId, which],
  );
  return rows.length;
}

export async function savePushSubscription(
  db: SqlExecutor,
  person: { organizationId: string; userId: string },
  subscription: PushSubscriptionInput,
): Promise<void> {
  await db.query(
    `insert into kete_push_subscriptions (organization_id, user_id, endpoint, p256dh, auth)
     values ($1, $2, $3, $4, $5)
     on conflict (organization_id, endpoint) do update set user_id = $2, p256dh = $4, auth = $5`,
    [
      person.organizationId,
      person.userId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
    ],
  );
}

export async function removePushSubscription(
  db: SqlExecutor,
  userId: string,
  endpoint: string,
): Promise<boolean> {
  const { rows } = await db.query<{ endpoint: string }>(
    `delete from kete_push_subscriptions where user_id = $1 and endpoint = $2 returning endpoint`,
    [userId, endpoint],
  );
  return rows.length > 0;
}

export async function pushSubscriptionsOf(
  db: SqlExecutor,
  userId: string,
): Promise<PushSubscriptionInput[]> {
  const { rows } = await db.query<{ endpoint: string; p256dh: string; auth: string }>(
    `select endpoint, p256dh, auth from kete_push_subscriptions where user_id = $1`,
    [userId],
  );
  return rows.map((r) => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }));
}
