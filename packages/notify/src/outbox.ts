import { randomBytes } from 'node:crypto';
import { newId } from '@kete/records';
import { organizationPolicySql, type SqlExecutor } from '@kete/tenancy';
import {
  ChatChannelError,
  type ChatAction,
  type ChatChannel,
  type ChatChannelName,
  type ChatInbound,
  type ChatSendResult,
  type ChatStatus,
} from './chat.js';
import { open, seal, secretsKey } from './secrets.js';
import { telegramChannel } from './telegram.js';
import { whatsAppChannel } from './whatsapp.js';

// The outbox to people (spec 088): what sits between « something happened » and « a message
// left ». Whether she agreed, in which words, through which channel, from whose number, and what
// happened to it. The app decides when a message is due and with which values; this file decides
// whether it may leave, sends it, and keeps the trace.

export interface ChatOutboxMigrationOptions {
  /** Default `public`. */
  schema?: string;
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;
const checked = (name: string) => {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
};

/** The four tables of the outbox, each with its row-level security in the same migration. */
export function chatOutboxMigrationSql(options: ChatOutboxMigrationOptions): string {
  const s = checked(options.schema ?? 'public');
  const app = checked(options.appRole);
  const secure = (table: string, grants: string) => `
${organizationPolicySql({ schema: s, table, appRole: app })}
grant ${grants} on ${s}.${table} to ${app};`;
  return `
-- From whose number, from which bot: one sender per organization and channel. Its credentials are
-- sealed by the application under a key the database never sees.
create table ${s}.kete_chat_senders (
  organization_id text not null,
  channel text not null check (channel in ('whatsapp', 'telegram')),
  -- What routes a webhook to this organization: the provider's own name of the number or the bot.
  account text not null check (length(account) between 1 and 128),
  -- What people see: the number, the bot's name.
  label text not null default '' check (length(label) <= 120),
  credentials text not null,
  connected_at timestamptz not null default now(),
  primary key (organization_id, channel)
);
-- An account belongs to one organization: two never share a sender.
create unique index kete_chat_senders_account on ${s}.kete_chat_senders (channel, account);
${secure('kete_chat_senders', 'select, insert, update, delete')}

-- Who can be written to: the app's own reference of a person, where she is reached, her consent.
create table ${s}.kete_chat_contacts (
  organization_id text not null,
  contact_id text not null,
  reference text not null check (length(reference) between 1 and 128),
  phone text check (phone ~ '^[0-9]{6,20}$'),
  -- The provider's own identifiers of her, kept when a channel gives them (she may hide her number).
  whatsapp_id text,
  telegram_id text,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'telegram', 'none')),
  consent boolean not null default false,
  consent_at timestamptz,
  link_token text,
  created_at timestamptz not null default now(),
  primary key (organization_id, contact_id),
  unique (organization_id, reference)
);
create unique index kete_chat_contacts_token on ${s}.kete_chat_contacts (organization_id, link_token)
  where link_token is not null;
create index kete_chat_contacts_phone on ${s}.kete_chat_contacts (organization_id, phone)
  where phone is not null;
create index kete_chat_contacts_whatsapp on ${s}.kete_chat_contacts (organization_id, whatsapp_id)
  where whatsapp_id is not null;
create index kete_chat_contacts_telegram on ${s}.kete_chat_contacts (organization_id, telegram_id)
  where telegram_id is not null;
${secure('kete_chat_contacts', 'select, insert, update, delete')}

-- The organization's words per kind of message: off until it turns it on.
create table ${s}.kete_chat_templates (
  organization_id text not null,
  kind text not null check (kind ~ '^[a-z][a-z0-9_.-]{1,40}$'),
  enabled boolean not null default false,
  body text not null check (length(body) between 1 and 1000),
  -- The approved template of the same words at the provider, when it asks for one, and its language.
  provider_template text not null default '',
  provider_language text not null default 'fr',
  updated_at timestamptz not null default now(),
  primary key (organization_id, kind)
);
${secure('kete_chat_templates', 'select, insert, update, delete')}

-- Every message, out and in, with what happened to it.
create table ${s}.kete_chat_messages (
  organization_id text not null,
  message_id text not null,
  -- Null for a sender nobody knows yet: her first message is kept all the same.
  contact_id text,
  direction text not null check (direction in ('out', 'in')),
  kind text not null check (kind ~ '^[a-z][a-z0-9_.-]{1,40}$'),
  -- What the app ties it to: a deposit, a decision.
  subject text check (length(subject) <= 128),
  channel text not null check (channel in ('whatsapp', 'telegram', 'none')),
  address text not null default '',
  body text not null check (length(body) <= 4000),
  -- The values of the placeholders, in their order, for a provider's approved template.
  parameters jsonb not null default '[]',
  provider_template text not null default '',
  provider_language text not null default '',
  actions jsonb not null default '[]',
  -- Set when the provider refused the free words: only its approved template may leave.
  template_only boolean not null default false,
  status text not null
    check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped', 'received')),
  reason text not null default '',
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  provider_message_id text,
  billable boolean,
  cost_category text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  status_at timestamptz,
  primary key (organization_id, message_id),
  foreign key (organization_id, contact_id)
    references ${s}.kete_chat_contacts (organization_id, contact_id) on delete set null (contact_id)
);
-- A provider that delivers twice is heard once; a status finds its message.
create unique index kete_chat_messages_provider
  on ${s}.kete_chat_messages (organization_id, channel, provider_message_id)
  where provider_message_id is not null;
create index kete_chat_messages_queued on ${s}.kete_chat_messages (organization_id, created_at)
  where status = 'queued';
create index kete_chat_messages_latest on ${s}.kete_chat_messages (organization_id, created_at desc);
create index kete_chat_messages_contact
  on ${s}.kete_chat_messages (organization_id, contact_id, created_at desc);
${secure('kete_chat_messages', 'select, insert, update')}

-- Two questions cross the organizations' boundary, and they are answered with an organization's
-- identifier only — never a number, a name, a word of a message nor a credential:
--   · a webhook has no organization yet: whose account was this notification sent to?
--   · a worker has no organization either: which organizations have something waiting to leave?
create function ${s}.kete_chat_organization_of_account(p_channel text, p_account text)
  returns text language sql stable security definer set search_path = ${s}, pg_temp
  as $fn$ select organization_id from kete_chat_senders
           where channel = p_channel and account = p_account $fn$;
create function ${s}.kete_chat_organizations_waiting()
  returns table (organization_id text)
  language sql stable security definer set search_path = ${s}, pg_temp
  as $fn$ select distinct m.organization_id from kete_chat_messages m
           where m.status = 'queued'
             and (m.next_attempt_at is null or m.next_attempt_at <= now()) $fn$;
revoke all on function ${s}.kete_chat_organization_of_account(text, text) from public;
revoke all on function ${s}.kete_chat_organizations_waiting() from public;
grant execute on function ${s}.kete_chat_organization_of_account(text, text) to ${app};
grant execute on function ${s}.kete_chat_organizations_waiting() to ${app};
`;
}

/** What the outbox refuses, in words an app can act on. */
export class ChatOutboxError extends Error {
  constructor(
    readonly code:
      | 'secrets_off'
      | 'account_taken'
      | 'template_empty'
      | 'template_unknown_placeholder'
      | 'unknown_message',
    readonly detail = '',
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'ChatOutboxError';
  }
}

// --- Senders -------------------------------------------------------------------------------------

/** What an organization gives to connect its own number, or its own bot. */
export type ChatSenderInput =
  | {
      channel: 'whatsapp';
      /** The provider's identifier of the number: it routes a webhook to the organization. */
      phoneNumberId: string;
      accessToken: string;
      /** What signs each notification. */
      appSecret: string;
      label?: string;
    }
  | {
      channel: 'telegram';
      botToken: string;
      /** The secret given to the provider when the webhook was set. */
      webhookSecret: string;
      label?: string;
    };

/** A sender with its secrets opened: only ever in memory, to send or to check a webhook. */
export type ChatSenderSecrets =
  | { channel: 'whatsapp'; account: string; accessToken: string; appSecret: string }
  | { channel: 'telegram'; account: string; botToken: string; webhookSecret: string };

export interface ChatOutboxOptions {
  /** The deployment's key, 32 random bytes in base64. Default: `KETE_SECRETS_KEY`. */
  secretsKey?: string;
  /** How a sender's channel is made. Default: the adapters of this package; tests give their own. */
  connect?: (sender: ChatSenderSecrets) => ChatChannel;
}

export interface ChatSenderView {
  channel: ChatChannelName;
  account: string;
  label: string;
  connectedAt: string;
  /** « to reconnect »: sealed under a key this deployment no longer holds. */
  state: 'connected' | 'to_reconnect';
}

const adapterOf = (sender: ChatSenderSecrets): ChatChannel =>
  sender.channel === 'whatsapp'
    ? whatsAppChannel({ accessToken: sender.accessToken, phoneNumberId: sender.account })
    : telegramChannel({ botToken: sender.botToken });

/** Whether this deployment can keep a sender's credentials: its key is set. */
export function chatSecretsOn(key?: string): boolean {
  return secretsKey(key) !== null;
}

/**
 * Connects the organization's own sender on a channel — or replaces it. Its credentials are sealed
 * before they reach the database. An account already connected by another organization is refused.
 */
export async function connectChatSender(
  db: SqlExecutor,
  organizationId: string,
  sender: ChatSenderInput,
  options: ChatOutboxOptions = {},
): Promise<void> {
  const key = secretsKey(options.secretsKey);
  if (!key) throw new ChatOutboxError('secrets_off');
  const account =
    sender.channel === 'whatsapp' ? sender.phoneNumberId : (sender.botToken.split(':')[0] ?? '');
  const secrets =
    sender.channel === 'whatsapp'
      ? { accessToken: sender.accessToken, appSecret: sender.appSecret }
      : { botToken: sender.botToken, webhookSecret: sender.webhookSecret };
  try {
    await db.query(
      `insert into kete_chat_senders (organization_id, channel, account, label, credentials)
       values ($1, $2, $3, $4, $5)
       on conflict (organization_id, channel) do update
         set account = excluded.account, label = excluded.label,
             credentials = excluded.credentials, connected_at = now()`,
      [
        organizationId,
        sender.channel,
        account,
        (sender.label ?? '').slice(0, 120),
        seal(key, JSON.stringify(secrets)),
      ],
    );
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw new ChatOutboxError('account_taken');
    throw error;
  }
}

/** The organization's sender on a channel with its secrets opened, or null: none, or to reconnect. */
export async function openChatSender(
  db: SqlExecutor,
  channel: ChatChannelName,
  options: ChatOutboxOptions = {},
): Promise<ChatSenderSecrets | null> {
  const key = secretsKey(options.secretsKey);
  if (!key) return null;
  const { rows } = await db.query<{ account: string; credentials: string }>(
    `select account, credentials from kete_chat_senders where channel = $1`,
    [channel],
  );
  const row = rows[0];
  const opened = row ? open(key, row.credentials) : null;
  if (!row || opened === null) return null;
  const secrets = JSON.parse(opened) as Record<string, string>;
  return channel === 'whatsapp'
    ? {
        channel,
        account: row.account,
        accessToken: secrets.accessToken ?? '',
        appSecret: secrets.appSecret ?? '',
      }
    : {
        channel,
        account: row.account,
        botToken: secrets.botToken ?? '',
        webhookSecret: secrets.webhookSecret ?? '',
      };
}

/** The organization's own channel, to download what she sent or to show that an answer comes. */
export async function chatChannelOf(
  db: SqlExecutor,
  channel: ChatChannelName,
  options: ChatOutboxOptions = {},
): Promise<ChatChannel | null> {
  const sender = await openChatSender(db, channel, options);
  return sender ? (options.connect ?? adapterOf)(sender) : null;
}

/** The organization's senders, without any credential. */
export async function listChatSenders(
  db: SqlExecutor,
  options: ChatOutboxOptions = {},
): Promise<ChatSenderView[]> {
  const key = secretsKey(options.secretsKey);
  const { rows } = await db.query<{
    channel: ChatChannelName;
    account: string;
    label: string;
    credentials: string;
    connected_at: Date;
  }>(
    `select channel, account, label, credentials, connected_at from kete_chat_senders
      order by channel`,
  );
  return rows.map((row) => ({
    channel: row.channel,
    account: row.account,
    label: row.label,
    connectedAt: row.connected_at.toISOString(),
    state: key && open(key, row.credentials) !== null ? 'connected' : 'to_reconnect',
  }));
}

export async function disconnectChatSender(
  db: SqlExecutor,
  channel: ChatChannelName,
): Promise<boolean> {
  const { rows } = await db.query(
    `delete from kete_chat_senders where channel = $1 returning channel`,
    [channel],
  );
  return rows.length > 0;
}

// --- Contacts ------------------------------------------------------------------------------------

export type ChatContactChannel = ChatChannelName | 'none';

export interface ChatContact {
  contactId: string;
  /** The app's own reference of the person: a customer, a member. */
  reference: string;
  phone: string | null;
  channel: ChatContactChannel;
  consent: boolean;
  consentAt: string | null;
  /** Whether she can be reached on her channel today: a number, or a chat she opened herself. */
  reachable: boolean;
}

interface ContactRow extends Record<string, unknown> {
  contact_id: string;
  reference: string;
  phone: string | null;
  whatsapp_id: string | null;
  telegram_id: string | null;
  channel: ChatContactChannel;
  consent: boolean;
  consent_at: Date | null;
}

const contactColumns = `contact_id, reference, phone, whatsapp_id, telegram_id, channel, consent,
  consent_at`;

/** Where a contact is reached on her channel, or null. */
const addressOf = (contact: ContactRow): string | null =>
  contact.channel === 'telegram'
    ? contact.telegram_id
    : contact.channel === 'whatsapp'
      ? (contact.phone ?? contact.whatsapp_id)
      : null;

const contactOf = (row: ContactRow): ChatContact => ({
  contactId: row.contact_id,
  reference: row.reference,
  phone: row.phone,
  channel: row.channel,
  consent: row.consent,
  consentAt: row.consent_at?.toISOString() ?? null,
  reachable: addressOf(row) !== null,
});

/**
 * Keeps who can be written to, by the app's own reference of her. What is not given is left as it
 * was; her consent is never touched here. A new number forgets the provider's identifier of the
 * former one.
 */
export async function saveChatContact(
  db: SqlExecutor,
  organizationId: string,
  input: { reference: string; phone?: string | null; channel?: ChatContactChannel },
): Promise<string> {
  const digits = input.phone?.replace(/\D/g, '') || null;
  const { rows } = await db.query<{ contact_id: string }>(
    `insert into kete_chat_contacts as c (organization_id, contact_id, reference, phone, channel)
     values ($1, $2, $3, $4, coalesce($5::text, 'whatsapp'))
     on conflict (organization_id, reference) do update
       set phone = case when $6 then excluded.phone else c.phone end,
           whatsapp_id = case when $6 and excluded.phone is distinct from c.phone
                              then null else c.whatsapp_id end,
           channel = coalesce($5::text, c.channel)
     returning contact_id`,
    [
      organizationId,
      newId('chc'),
      input.reference,
      digits,
      input.channel ?? null,
      input.phone !== undefined,
    ],
  );
  return rows[0]?.contact_id ?? '';
}

export async function chatContactOf(
  db: SqlExecutor,
  reference: string,
): Promise<ChatContact | null> {
  const { rows } = await db.query<ContactRow>(
    `select ${contactColumns} from kete_chat_contacts where reference = $1`,
    [reference],
  );
  return rows[0] ? contactOf(rows[0]) : null;
}

/**
 * Her consent, given or withdrawn by a named gesture — never inferred from a message she sent.
 * Returns whether the contact exists.
 */
export async function setChatConsent(
  db: SqlExecutor,
  reference: string,
  consent: boolean,
): Promise<boolean> {
  const { rows } = await db.query(
    `update kete_chat_contacts set consent = $2, consent_at = now()
      where reference = $1 returning contact_id`,
    [reference, consent],
  );
  return rows.length > 0;
}

/**
 * The token of the link she opens to be reached on a channel that cannot write first, or that
 * hides her number: made once. Null for an unknown contact.
 */
export async function chatLinkTokenOf(db: SqlExecutor, reference: string): Promise<string | null> {
  const { rows } = await db.query<{ link_token: string | null }>(
    `select link_token from kete_chat_contacts where reference = $1`,
    [reference],
  );
  if (!rows[0]) return null;
  if (rows[0].link_token) return rows[0].link_token;
  const token = randomBytes(12).toString('base64url');
  await db.query(`update kete_chat_contacts set link_token = $2 where reference = $1`, [
    reference,
    token,
  ]);
  return token;
}

// --- Templates -----------------------------------------------------------------------------------

export interface ChatMessageTemplate {
  /** The kind of message, in the app's words: `deposit.ready`, `decision.waiting`. */
  kind: string;
  enabled: boolean;
  body: string;
  /** The approved template of the same words at the provider, when it asks for one. */
  providerTemplate?: string;
  providerLanguage?: string;
}

const placeholder = /\{([a-zA-Z_]+)\}/g;

/** The placeholders of a template's words that the app does not know. */
export function unknownChatPlaceholders(body: string, known: readonly string[]): string[] {
  const names = [...body.matchAll(placeholder)].map((match) => match[1] ?? '');
  return [...new Set(names)].filter((name) => !known.includes(name));
}

/** Fills a template's words with the values of a message. */
export function renderChatTemplate(body: string, values: Record<string, string>): string {
  return body.replace(placeholder, (whole, name: string) => values[name] ?? whole);
}

/**
 * Saves the organization's words for a kind of message. An unknown placeholder is refused now, not
 * when a message leaves.
 */
export async function saveChatTemplate(
  db: SqlExecutor,
  organizationId: string,
  template: ChatMessageTemplate,
  /** What this kind of message may name. */
  placeholders: readonly string[],
): Promise<void> {
  if (!template.body.trim()) throw new ChatOutboxError('template_empty');
  const unknown = unknownChatPlaceholders(template.body, placeholders)[0];
  if (unknown !== undefined) throw new ChatOutboxError('template_unknown_placeholder', unknown);
  await db.query(
    `insert into kete_chat_templates
       (organization_id, kind, enabled, body, provider_template, provider_language)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (organization_id, kind) do update
       set enabled = excluded.enabled, body = excluded.body,
           provider_template = excluded.provider_template,
           provider_language = excluded.provider_language, updated_at = now()`,
    [
      organizationId,
      template.kind,
      template.enabled,
      template.body,
      template.providerTemplate ?? '',
      template.providerLanguage ?? 'fr',
    ],
  );
}

export async function listChatTemplates(db: SqlExecutor): Promise<Required<ChatMessageTemplate>[]> {
  const { rows } = await db.query<{
    kind: string;
    enabled: boolean;
    body: string;
    provider_template: string;
    provider_language: string;
  }>(
    `select kind, enabled, body, provider_template, provider_language from kete_chat_templates
      order by kind`,
  );
  return rows.map((row) => ({
    kind: row.kind,
    enabled: row.enabled,
    body: row.body,
    providerTemplate: row.provider_template,
    providerLanguage: row.provider_language,
  }));
}

// --- Queueing ------------------------------------------------------------------------------------

/** Why a message did not leave, when nothing was even tried. */
export type ChatSkipReason =
  'template_off' | 'unknown_contact' | 'no_consent' | 'no_channel' | 'no_address' | 'not_connected';

export interface ChatQueued {
  /** Null when nothing was kept: the organization did not turn this kind on, or nobody is known. */
  messageId: string | null;
  status: 'queued' | 'skipped';
  reason: ChatSkipReason | '';
}

interface Draft {
  kind: string;
  subject?: string | undefined;
  body: string;
  parameters?: string[];
  providerTemplate?: string;
  providerLanguage?: string;
  actions?: ChatAction[] | undefined;
}

/** Keeps a message for a contact: queued when it may leave, skipped with its reason otherwise. */
async function file(
  db: SqlExecutor,
  organizationId: string,
  contact: ContactRow,
  draft: Draft,
): Promise<ChatQueued> {
  const address = addressOf(contact);
  let reason: ChatSkipReason | '' = '';
  if (!contact.consent) reason = 'no_consent';
  else if (contact.channel === 'none') reason = 'no_channel';
  else if (!address) reason = 'no_address';
  else {
    // From the organization's own sender, or not at all: never another's, never simulated.
    const { rows } = await db.query(
      `select 1 as connected from kete_chat_senders where channel = $1`,
      [contact.channel],
    );
    if (rows.length === 0) reason = 'not_connected';
  }
  const messageId = newId('chm');
  await db.query(
    `insert into kete_chat_messages
       (organization_id, message_id, contact_id, direction, kind, subject, channel, address, body,
        parameters, provider_template, provider_language, actions, status, reason)
     values ($1, $2, $3, 'out', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      organizationId,
      messageId,
      contact.contact_id,
      draft.kind,
      draft.subject ?? null,
      contact.channel,
      reason === '' ? address : '',
      draft.body.slice(0, 4000),
      JSON.stringify(draft.parameters ?? []),
      draft.providerTemplate ?? '',
      draft.providerLanguage ?? '',
      JSON.stringify(draft.actions ?? []),
      reason === '' ? 'queued' : 'skipped',
      reason,
    ],
  );
  return { messageId, status: reason === '' ? 'queued' : 'skipped', reason };
}

async function contactRow(db: SqlExecutor, reference: string): Promise<ContactRow | null> {
  const { rows } = await db.query<ContactRow>(
    `select ${contactColumns} from kete_chat_contacts where reference = $1`,
    [reference],
  );
  return rows[0] ?? null;
}

/**
 * Queues a message of a kind for a contact, in the organization's own words. It leaves only when
 * the organization turned that kind on, she agreed, she can be reached and the organization has
 * its own sender; otherwise the message is kept as skipped, with its reason. The values, in the
 * order given, are also the parameters of the provider's approved template.
 */
export async function queueChatMessage(
  db: SqlExecutor,
  organizationId: string,
  input: {
    reference: string;
    kind: string;
    values: Record<string, string>;
    subject?: string;
    actions?: ChatAction[];
  },
): Promise<ChatQueued> {
  const template = (await listChatTemplates(db)).find((t) => t.kind === input.kind);
  if (!template?.enabled) return { messageId: null, status: 'skipped', reason: 'template_off' };
  const contact = await contactRow(db, input.reference);
  if (!contact) return { messageId: null, status: 'skipped', reason: 'unknown_contact' };
  return file(db, organizationId, contact, {
    kind: input.kind,
    subject: input.subject,
    body: renderChatTemplate(template.body, input.values),
    parameters: Object.values(input.values),
    providerTemplate: template.providerTemplate,
    providerLanguage: template.providerLanguage,
    actions: input.actions,
  });
}

/**
 * Queues plain words for a contact, outside the organization's templates: the same consent, the
 * same channel, the same sender as any message.
 */
export async function queueChatText(
  db: SqlExecutor,
  organizationId: string,
  input: {
    reference: string;
    text: string;
    kind?: string;
    subject?: string;
    actions?: ChatAction[];
  },
): Promise<ChatQueued> {
  const contact = await contactRow(db, input.reference);
  if (!contact) return { messageId: null, status: 'skipped', reason: 'unknown_contact' };
  return file(db, organizationId, contact, {
    kind: input.kind ?? 'text',
    subject: input.subject,
    body: input.text,
    actions: input.actions,
  });
}

/**
 * Queues the answer to a message that was heard, to whoever sent it and where she wrote — known
 * contact or not, and whatever her consent to be written to first: she just wrote.
 */
export async function queueChatReply(
  db: SqlExecutor,
  organizationId: string,
  input: { to: string; text: string; subject?: string; actions?: ChatAction[] },
): Promise<string> {
  const { rows } = await db.query<{
    contact_id: string | null;
    channel: ChatChannelName;
    address: string;
  }>(
    `select contact_id, channel, address from kete_chat_messages
      where message_id = $1 and direction = 'in'`,
    [input.to],
  );
  const heard = rows[0];
  if (!heard) throw new ChatOutboxError('unknown_message', input.to);
  const messageId = newId('chm');
  await db.query(
    `insert into kete_chat_messages
       (organization_id, message_id, contact_id, direction, kind, subject, channel, address, body,
        actions, status)
     values ($1, $2, $3, 'out', 'reply', $4, $5, $6, $7, $8, 'queued')`,
    [
      organizationId,
      messageId,
      heard.contact_id,
      input.subject ?? null,
      heard.channel,
      heard.address,
      input.text.slice(0, 4000),
      JSON.stringify(input.actions ?? []),
    ],
  );
  return messageId;
}

// --- Delivery ------------------------------------------------------------------------------------

export interface ChatDelivery {
  sent: number;
  failed: number;
  /** Left waiting for another try: the network failed. */
  retried: number;
}

/** How long a message waits after each failure of the network, in seconds; then it fails. */
const retryAfter = [60, 300, 1800, 7200];

const receiptId = (result: ChatSendResult): string | null =>
  result && typeof result === 'object' ? result.providerMessageId : null;

/**
 * Sends what waits for the organization, through its own sender. A refusal keeps its reason; a
 * failure of the network is tried again later. Where a channel only lets a business write first
 * with an approved template, the template leaves unless she wrote in the last 24 hours — then
 * the organization's own words leave, with their buttons.
 */
export async function deliverChat(
  db: SqlExecutor,
  options: ChatOutboxOptions & { limit?: number } = {},
): Promise<ChatDelivery> {
  const result: ChatDelivery = { sent: 0, failed: 0, retried: 0 };
  const channels = new Map<ChatChannelName, ChatChannel | null>();
  const channelFor = async (name: ChatChannelName) => {
    if (!channels.has(name)) channels.set(name, await chatChannelOf(db, name, options));
    return channels.get(name) ?? null;
  };
  const { rows } = await db.query<{
    message_id: string;
    channel: ChatChannelName;
    address: string;
    body: string;
    parameters: string[];
    provider_template: string;
    provider_language: string;
    actions: ChatAction[];
    template_only: boolean;
    attempts: number;
    in_window: boolean;
  }>(
    `select m.message_id, m.channel, m.address, m.body, m.parameters, m.provider_template,
            m.provider_language, m.actions, m.template_only, m.attempts,
            exists (select 1 from kete_chat_messages i
                     where i.direction = 'in' and i.channel = m.channel
                       and (i.contact_id = m.contact_id or i.address = m.address)
                       and i.created_at > now() - interval '24 hours') as in_window
       from kete_chat_messages m
      where m.status = 'queued' and m.direction = 'out' and m.channel <> 'none'
        and (m.next_attempt_at is null or m.next_attempt_at <= now())
      order by m.created_at limit $1 for update of m skip locked`,
    [Math.min(Math.max(options.limit ?? 50, 1), 200)],
  );
  for (const message of rows) {
    const channel = await channelFor(message.channel);
    if (!channel) {
      await settle(db, message.message_id, 'failed', 'not_connected');
      result.failed += 1;
      continue;
    }
    try {
      const asTemplate =
        message.provider_template !== '' && (message.template_only || !message.in_window)
          ? channel.sendTemplate?.bind(channel)
          : undefined;
      const receipt = asTemplate
        ? await asTemplate(message.address, {
            name: message.provider_template,
            language: message.provider_language || 'fr',
            parameters: message.parameters,
          })
        : await channel.sendText(
            message.address,
            message.body,
            message.actions.length > 0 ? message.actions : undefined,
          );
      await db.query(
        `update kete_chat_messages
            set status = 'sent', reason = '', attempts = attempts + 1, next_attempt_at = null,
                provider_message_id = $2, sent_at = now(), status_at = now()
          where message_id = $1`,
        [message.message_id, receiptId(receipt)],
      );
      result.sent += 1;
    } catch (error) {
      const reason = error instanceof ChatChannelError ? error.reason : 'network';
      const delay = reason === 'network' ? retryAfter[message.attempts] : undefined;
      if (delay !== undefined) {
        await db.query(
          `update kete_chat_messages
              set attempts = attempts + 1, reason = 'network',
                  next_attempt_at = now() + make_interval(secs => $2)
            where message_id = $1`,
          [message.message_id, delay],
        );
        result.retried += 1;
      } else {
        await settle(db, message.message_id, 'failed', reason);
        result.failed += 1;
      }
    }
  }
  return result;
}

async function settle(
  db: SqlExecutor,
  messageId: string,
  status: 'failed',
  reason: string,
): Promise<void> {
  await db.query(
    `update kete_chat_messages
        set status = $2, reason = $3, attempts = attempts + 1, next_attempt_at = null,
            status_at = now()
      where message_id = $1`,
    [messageId, status, reason],
  );
}

/** Puts a failed message back in the queue, as new. */
export async function requeueChatMessage(db: SqlExecutor, messageId: string): Promise<boolean> {
  const { rows } = await db.query(
    `update kete_chat_messages
        set status = 'queued', reason = '', attempts = 0, next_attempt_at = null
      where message_id = $1 and status = 'failed' and direction = 'out' returning message_id`,
    [messageId],
  );
  return rows.length > 0;
}

const progress: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

/**
 * Notes what the provider says of a message that left: delivered, read, failed — and whether it
 * was billed, in which category. A message the provider accepted and then refused because she had
 * not written in the last 24 hours leaves again as its approved template, when there is one.
 * Returns whether the status found its message.
 */
export async function noteChatStatus(db: SqlExecutor, status: ChatStatus): Promise<boolean> {
  const { rows } = await db.query<{
    message_id: string;
    status: string;
    provider_template: string;
    template_only: boolean;
  }>(
    `select message_id, status, provider_template, template_only from kete_chat_messages
      where direction = 'out' and provider_message_id = $1 for update`,
    [status.providerMessageId],
  );
  const message = rows[0];
  if (!message) return false;
  if (status.status === 'failed') {
    if (message.status !== 'sent') return true;
    if (
      status.reason === 'outside_window' &&
      message.provider_template !== '' &&
      !message.template_only
    ) {
      await db.query(
        `update kete_chat_messages
            set status = 'queued', reason = '', template_only = true, provider_message_id = null,
                next_attempt_at = null, status_at = now()
          where message_id = $1`,
        [message.message_id],
      );
    } else {
      await db.query(
        `update kete_chat_messages set status = 'failed', reason = $2, status_at = now()
          where message_id = $1`,
        [message.message_id, status.reason ?? 'provider_refused'],
      );
    }
    return true;
  }
  const forward = (progress[status.status] ?? 0) > (progress[message.status] ?? 99);
  await db.query(
    `update kete_chat_messages
        set status = case when $2 then $3 else status end,
            status_at = case when $2 then now() else status_at end,
            billable = coalesce($4, billable), cost_category = coalesce($5, cost_category)
      where message_id = $1`,
    [message.message_id, forward, status.status, status.billable, status.category],
  );
  return true;
}

// --- Hearing -------------------------------------------------------------------------------------

/** A message as the organization heard it. */
export interface ChatHeardMessage {
  organizationId: string;
  /** What `queueChatReply` answers to. */
  messageId: string;
  /** Null for a sender nobody knows yet. */
  contactId: string | null;
  reference: string | null;
  /**
   * `stop`: she withdrew her consent, and it is done. `link`: she opened her link, and her chat is
   * tied to her contact. `message`: anything else — what it means is the app's trade.
   */
  intent: 'stop' | 'link' | 'message';
  message: ChatInbound;
}

const stopWords = /^(stop|arr[eê]t(er|ez)?|d[ée]sabonner|unsubscribe)(\s|[.!]|$)/i;
const linkWords = /^(?:\/start\s+)?([A-Za-z0-9_-]{16})$/;

/**
 * Keeps a message a channel proved, once: a provider that delivers twice is heard once (null the
 * second time). She is found by her number when the channel gives it, by the channel's own
 * identifier of her otherwise; an unknown sender's message is kept all the same.
 */
export async function hearChat(
  db: SqlExecutor,
  organizationId: string,
  message: ChatInbound,
): Promise<ChatHeardMessage | null> {
  const { sender } = message;
  const found = await db.query<ContactRow>(
    message.channel === 'whatsapp'
      ? `select ${contactColumns} from kete_chat_contacts
          where whatsapp_id = $1 or ($2::text is not null and phone = $2)
          order by (whatsapp_id is not distinct from $1) desc limit 1`
      : `select ${contactColumns} from kete_chat_contacts
          where telegram_id = $1 limit 1`,
    message.channel === 'whatsapp' ? [sender.id, sender.phone] : [sender.id],
  );
  let contact = found.rows[0] ?? null;
  const messageId = newId('chm');
  const kept = await db.query(
    `insert into kete_chat_messages
       (organization_id, message_id, contact_id, direction, kind, channel, address, body, status,
        provider_message_id)
     values ($1, $2, $3, 'in', $4, $5, $6, $7, 'received', $8)
     on conflict do nothing returning message_id`,
    [
      organizationId,
      messageId,
      contact?.contact_id ?? null,
      message.kind,
      message.channel,
      sender.address,
      (message.text ?? message.action ?? '').slice(0, 4000),
      message.providerMessageId,
    ],
  );
  if (kept.rows.length === 0) return null;

  const said = message.kind === 'text' ? (message.text ?? '').trim() : '';
  let intent: ChatHeardMessage['intent'] = 'message';
  const token = linkWords.exec(said)?.[1];
  if (token) {
    // Her link, opened by herself: the gesture that ties this chat to her and says she agrees.
    const tied = await db.query<ContactRow>(
      message.channel === 'whatsapp'
        ? `update kete_chat_contacts
              set whatsapp_id = $2, phone = coalesce(phone, $3), channel = 'whatsapp',
                  consent = true, consent_at = now()
            where link_token = $1 returning ${contactColumns}`
        : `update kete_chat_contacts
              set telegram_id = $2, channel = 'telegram', consent = true, consent_at = now()
            where link_token = $1 returning ${contactColumns}`,
      message.channel === 'whatsapp' ? [token, sender.id, sender.phone] : [token, sender.id],
    );
    if (tied.rows[0]) {
      contact = tied.rows[0];
      intent = 'link';
      await db.query(`update kete_chat_messages set contact_id = $2 where message_id = $1`, [
        messageId,
        contact.contact_id,
      ]);
    }
  }
  if (contact && intent === 'message') {
    if (stopWords.test(said)) {
      await db.query(
        `update kete_chat_contacts set consent = false, consent_at = now() where contact_id = $1`,
        [contact.contact_id],
      );
      intent = 'stop';
    }
    // Found by her number: the channel's own identifier of her is kept too, for the day she hides it.
    if (message.channel === 'whatsapp' && sender.id !== sender.phone) {
      await db.query(
        `update kete_chat_contacts set whatsapp_id = $2
          where contact_id = $1 and whatsapp_id is distinct from $2`,
        [contact.contact_id, sender.id],
      );
    }
  }
  return {
    organizationId,
    messageId,
    contactId: contact?.contact_id ?? null,
    reference: contact?.reference ?? null,
    intent,
    message,
  };
}

// --- Reading -------------------------------------------------------------------------------------

export type ChatMessageStatus =
  'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped' | 'received';

export interface ChatMessage {
  messageId: string;
  reference: string | null;
  direction: 'out' | 'in';
  kind: string;
  subject: string | null;
  channel: ChatContactChannel;
  body: string;
  status: ChatMessageStatus;
  /** Why it did not leave, or why it failed. */
  reason: string;
  attempts: number;
  billable: boolean | null;
  costCategory: string | null;
  createdAt: string;
  sentAt: string | null;
}

/** The organization's messages, the latest first: all of them, a contact's, or a subject's. */
export async function listChatMessages(
  db: SqlExecutor,
  query: { reference?: string; subject?: string; limit?: number } = {},
): Promise<ChatMessage[]> {
  const { rows } = await db.query<{
    message_id: string;
    reference: string | null;
    direction: 'out' | 'in';
    kind: string;
    subject: string | null;
    channel: ChatContactChannel;
    body: string;
    status: ChatMessageStatus;
    reason: string;
    attempts: number;
    billable: boolean | null;
    cost_category: string | null;
    created_at: Date;
    sent_at: Date | null;
  }>(
    `select m.message_id, c.reference, m.direction, m.kind, m.subject, m.channel, m.body, m.status,
            m.reason, m.attempts, m.billable, m.cost_category, m.created_at, m.sent_at
       from kete_chat_messages m
       left join kete_chat_contacts c
         on c.organization_id = m.organization_id and c.contact_id = m.contact_id
      where ($1::text is null or c.reference = $1) and ($2::text is null or m.subject = $2)
      order by m.created_at desc, m.message_id desc limit $3`,
    [query.reference ?? null, query.subject ?? null, Math.min(Math.max(query.limit ?? 50, 1), 200)],
  );
  return rows.map((row) => ({
    messageId: row.message_id,
    reference: row.reference,
    direction: row.direction,
    kind: row.kind,
    subject: row.subject,
    channel: row.channel,
    body: row.body,
    status: row.status,
    reason: row.reason,
    attempts: row.attempts,
    billable: row.billable,
    costCategory: row.cost_category,
    createdAt: row.created_at.toISOString(),
    sentAt: row.sent_at?.toISOString() ?? null,
  }));
}

export interface ChatUsage {
  channel: ChatChannelName;
  /** The provider's category of cost, when it said one. */
  category: string | null;
  billable: boolean | null;
  count: number;
}

/**
 * What left in a month (`2026-10`), counted by channel and by the provider's category of cost. A
 * count, never an amount: a price is only shown where the deployment was given one.
 */
export async function chatUsage(db: SqlExecutor, month: string): Promise<ChatUsage[]> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new TypeError(`Not a month: ${month}`);
  const { rows } = await db.query<{
    channel: ChatChannelName;
    cost_category: string | null;
    billable: boolean | null;
    n: number;
  }>(
    `select channel, cost_category, billable, count(*)::int as n from kete_chat_messages
      where direction = 'out' and status in ('sent', 'delivered', 'read') and sent_at >= $1::date
        and sent_at < $1::date + interval '1 month'
      group by channel, cost_category, billable
      order by channel, cost_category nulls last, billable nulls last`,
    [`${month}-01`],
  );
  return rows.map((row) => ({
    channel: row.channel,
    category: row.cost_category,
    billable: row.billable,
    count: row.n,
  }));
}

// --- Across organizations: identifiers only ------------------------------------------------------

/** Whose account is this? The organization's identifier, or null. Asked outside any organization. */
export async function organizationOfChatAccount(
  lookup: SqlExecutor,
  channel: ChatChannelName,
  account: string,
): Promise<string | null> {
  const { rows } = await lookup.query<{ organization_id: string | null }>(
    `select kete_chat_organization_of_account($1, $2) as organization_id`,
    [channel, account],
  );
  return rows[0]?.organization_id ?? null;
}

/** The organizations with something waiting to leave: what a worker's round visits. */
export async function chatOrganizationsWaiting(lookup: SqlExecutor): Promise<string[]> {
  const { rows } = await lookup.query<{ organization_id: string }>(
    `select organization_id from kete_chat_organizations_waiting() order by organization_id`,
  );
  return rows.map((row) => row.organization_id);
}
