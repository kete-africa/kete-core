import { organizationPolicySql, type SqlExecutor } from '@kete/tenancy';
import { notify, ringDevices, type NotificationInput } from './inbox.js';
import type { PushSender } from './push.js';

// One attention model (spec 151; doctrine D-062, R14): one place decides who is told, of what, on
// which channel, once. Every signal is kept in her list (« Pour moi », her notifications); what is
// urgent rings her devices and her phone at any hour; what asks her to act rings them, but after
// her quiet hours; what she only needs to know waits in her list, and in her evening summary when
// she chose one. The same signal, by its key, is told once.

/** How much a signal weighs on her attention. */
export type AttentionWeight = 'urgent' | 'act' | 'know';

/** What she chose for her attention: her quiet hours, her time zone, her channels, her summary. */
export interface AttentionPrefs {
  /** `HH:MM` to `HH:MM` in her time zone, across midnight when `to` is earlier; null: none. */
  quietHours: { from: string; to: string } | null;
  /** IANA, `Africa/Lome`. */
  timeZone: string;
  /** The channels she chose beyond the product (`kete.notification_channels`). */
  channels: readonly string[];
  /** A summary by e-mail each evening of what remains unread (`kete.threads_digest`). */
  digest: 'none' | 'daily';
}

export const DEFAULT_ATTENTION: AttentionPrefs = {
  quietHours: null,
  timeZone: 'Africa/Lome',
  channels: ['email'],
  digest: 'none',
};

/** When a channel is reached: at once, once her quiet hours end, or not at all. */
export type Reach = { at: 'now' } | { at: 'later'; after: Date } | { at: 'never' };

export interface AttentionPlan {
  /** Kept in her list: always. */
  list: true;
  /** Her devices (Web Push). */
  devices: Reach;
  /** Her phone (WhatsApp or Telegram), when she chose one. */
  phone: Reach;
  /** In her evening summary while unread. */
  digest: boolean;
}

const minutesOf = (hhmm: string): number | null => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/** The hour and minute of a moment in a time zone, as minutes since midnight. */
function clockIn(timeZone: string, at: Date): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at);
  } catch {
    return clockIn(DEFAULT_ATTENTION.timeZone, at);
  }
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return value('hour') * 60 + value('minute');
}

/** Until when her quiet hours hold at `now`; null when she is not in them. */
export function quietUntil(prefs: AttentionPrefs, now: Date): Date | null {
  if (!prefs.quietHours) return null;
  const from = minutesOf(prefs.quietHours.from);
  const to = minutesOf(prefs.quietHours.to);
  if (from === null || to === null || from === to) return null;
  const clock = clockIn(prefs.timeZone, now);
  const inside = from < to ? clock >= from && clock < to : clock >= from || clock < to;
  if (!inside) return null;
  const left = (to - clock + 24 * 60) % (24 * 60);
  const until = new Date(now.getTime() + left * 60_000);
  until.setUTCSeconds(0, 0);
  return until;
}

const PHONES = ['whatsapp', 'telegram'];

/** What reaches her, and when, for a signal of this weight. */
export function planAttention(
  weight: AttentionWeight,
  prefs: AttentionPrefs = DEFAULT_ATTENTION,
  now: Date = new Date(),
): AttentionPlan {
  const phoneChosen = prefs.channels.some((channel) => PHONES.includes(channel));
  if (weight === 'urgent') {
    return {
      list: true,
      devices: { at: 'now' },
      phone: phoneChosen ? { at: 'now' } : { at: 'never' },
      digest: false,
    };
  }
  if (weight === 'act') {
    const until = quietUntil(prefs, now);
    const reach: Reach = until ? { at: 'later', after: until } : { at: 'now' };
    return {
      list: true,
      devices: reach,
      phone: phoneChosen ? reach : { at: 'never' },
      digest: false,
    };
  }
  return {
    list: true,
    devices: { at: 'never' },
    phone: { at: 'never' },
    digest: prefs.digest === 'daily',
  };
}

export interface AttentionMigrationOptions {
  /** Default `public`. */
  schema?: string;
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;
const checked = (name: string) => {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
};

/**
 * What each person was told, by the signal's key — once — and when her devices ring if her quiet
 * hours held them back. With its row-level security; after `notificationsMigrationSql`.
 */
export function attentionMigrationSql(options: AttentionMigrationOptions): string {
  const s = checked(options.schema ?? 'public');
  const app = checked(options.appRole);
  return `
create table ${s}.kete_attention (
  organization_id text not null,
  user_id text not null,
  key text not null check (length(key) between 1 and 200),
  weight text not null check (weight in ('urgent', 'act', 'know')),
  notification_id text not null,
  devices_after timestamptz,
  rung_at timestamptz,
  told_at timestamptz not null default now(),
  primary key (organization_id, user_id, key)
);
create index kete_attention_later on ${s}.kete_attention (devices_after)
  where devices_after is not null and rung_at is null;
${organizationPolicySql({ schema: s, table: 'kete_attention', appRole: app })}
grant select, insert, update on ${s}.kete_attention to ${app};

-- The worker has no organization: which ones have devices to ring now that quiet hours ended?
create function ${s}.kete_attention_organizations_waiting()
  returns table (organization_id text)
  language sql stable security definer set search_path = ${s}, pg_temp
  as $fn$ select distinct a.organization_id from kete_attention a
           where a.devices_after <= now() and a.rung_at is null $fn$;
revoke all on function ${s}.kete_attention_organizations_waiting() from public;
grant execute on function ${s}.kete_attention_organizations_waiting() to ${app};
`;
}

export interface Signal extends NotificationInput {
  weight: AttentionWeight;
  /** What makes it one signal: told once per person, however many times it is raised. */
  key: string;
}

export interface Attended {
  /** False when she was already told of this signal. */
  told: boolean;
  plan: AttentionPlan;
  notificationId: string | null;
  pushed: number;
}

/**
 * Tells a person of a signal, once: kept in her list, and on her devices as its weight and her
 * quiet hours say — at once, or by `ringPostponed` once they end. What reaches her phone is the
 * product's to queue (its words and buttons), following `plan.phone`.
 */
export async function attend(
  db: SqlExecutor,
  signal: Signal,
  options: { prefs?: AttentionPrefs; push?: PushSender | null; now?: Date } = {},
): Promise<Attended> {
  const now = options.now ?? new Date();
  const plan = planAttention(signal.weight, options.prefs ?? DEFAULT_ATTENTION, now);
  const { rows } = await db.query<{ key: string }>(
    `insert into kete_attention (organization_id, user_id, key, weight, notification_id,
       devices_after)
     values ($1, $2, $3, $4, '', $5)
     on conflict (organization_id, user_id, key) do nothing returning key`,
    [
      signal.organizationId,
      signal.userId,
      signal.key.slice(0, 200),
      signal.weight,
      plan.devices.at === 'later' ? plan.devices.after : null,
    ],
  );
  if (rows.length === 0) return { told: false, plan, notificationId: null, pushed: 0 };
  const { notificationId, pushed } = await notify(
    db,
    {
      organizationId: signal.organizationId,
      userId: signal.userId,
      kind: signal.kind,
      title: signal.title,
      ...(signal.body ? { body: signal.body } : {}),
      ...(signal.href ? { href: signal.href } : {}),
    },
    plan.devices.at === 'now' ? (options.push ?? null) : null,
  );
  await db.query(
    `update kete_attention set notification_id = $4
      where organization_id = $1 and user_id = $2 and key = $3`,
    [signal.organizationId, signal.userId, signal.key.slice(0, 200), notificationId],
  );
  return { told: true, plan, notificationId, pushed };
}

/**
 * Rings, in one organization, the devices her quiet hours held back — unless she read it since.
 * Answers how many devices were reached.
 */
export async function ringPostponed(
  db: SqlExecutor,
  push: PushSender | null,
  now: Date = new Date(),
): Promise<number> {
  const { rows } = await db.query<{
    organization_id: string;
    user_id: string;
    key: string;
    kind: string;
    title: string;
    body: string | null;
    href: string | null;
    read_at: Date | null;
  }>(
    `select a.organization_id, a.user_id, a.key, n.kind, n.title, n.body, n.href, n.read_at
       from kete_attention a
       join kete_notifications n
         on n.organization_id = a.organization_id and n.notification_id = a.notification_id
      where a.devices_after <= $1 and a.rung_at is null
      order by a.devices_after limit 200`,
    [now],
  );
  let rung = 0;
  for (const row of rows) {
    await db.query(
      `update kete_attention set rung_at = $4
        where organization_id = $1 and user_id = $2 and key = $3`,
      [row.organization_id, row.user_id, row.key, now],
    );
    if (row.read_at || !push) continue;
    rung += await ringDevices(db, push, {
      userId: row.user_id,
      kind: row.kind,
      title: row.title,
      ...(row.body ? { body: row.body } : {}),
      ...(row.href ? { href: row.href } : {}),
    });
  }
  return rung;
}

/** The organizations with devices to ring now that quiet hours ended (the worker's round). */
export async function attentionOrganizationsWaiting(lookup: SqlExecutor): Promise<string[]> {
  const { rows } = await lookup.query<{ organization_id: string }>(
    `select organization_id from kete_attention_organizations_waiting() order by organization_id`,
  );
  return rows.map((row) => row.organization_id);
}
