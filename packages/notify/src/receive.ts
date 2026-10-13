import type { SqlExecutor } from '@kete/tenancy';
import type { ChatChannelName } from './chat.js';
import {
  hearChat,
  noteChatStatus,
  openChatSender,
  organizationOfChatAccount,
  type ChatHeardMessage,
  type ChatOutboxOptions,
} from './outbox.js';
import { parseTelegramUpdate, telegramSecretIsValid } from './telegram.js';
import {
  parseWhatsAppNotification,
  parseWhatsAppStatuses,
  verifyWhatsAppSubscription,
  whatsAppAccountsOf,
  whatsAppSignatureIsValid,
} from './whatsapp.js';

// A webhook of a deployment where each organization has its own sender (spec 088). A notification
// arrives without an organization: the account it was sent to names one — an identifier, nothing
// else — and its signature is then checked with that organization's own secret, inside that
// organization. A notification nobody can vouch for is heard nowhere.

export interface ChatWebhookOptions extends ChatOutboxOptions {
  channel: ChatChannelName;
  /** A connection outside any organization: it only asks whose account a notification names. */
  lookup: SqlExecutor;
  /** A transaction of one organization (`inOrganization` of `@kete/tenancy`, on the app's pool). */
  inOrganization: <T>(organizationId: string, work: (db: SqlExecutor) => Promise<T>) => Promise<T>;
  /**
   * Where a provider checks the address once with a token (a GET): the deployment's own. Without
   * it the check is refused.
   */
  verifyToken?: string;
  /**
   * Where a notification does not name its account, the address does: the app reads it from its
   * route (`/webhooks/telegram/<account>`) and gives it here.
   */
  account?: string;
}

export interface ChatReceived {
  /** What to answer the provider, whatever was heard. */
  response: Response;
  /** The messages heard for the first time, each in its organization. */
  heard: ChatHeardMessage[];
  /** The statuses that found their message. */
  statuses: number;
}

const nothing = (status: number): ChatReceived => ({
  response: new Response(null, { status }),
  heard: [],
  statuses: 0,
});

/** A notification names a handful of accounts at most; more is not a provider speaking. */
const MAX_ACCOUNTS = 20;

async function receiveSigned(request: Request, options: ChatWebhookOptions): Promise<ChatReceived> {
  const raw = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return nothing(400);
  }
  const signature = request.headers.get('x-hub-signature-256');
  const received: ChatReceived = { response: new Response('ok'), heard: [], statuses: 0 };
  let known = 0;
  let vouched = 0;
  for (const account of whatsAppAccountsOf(body).slice(0, MAX_ACCOUNTS)) {
    const organizationId = await organizationOfChatAccount(options.lookup, 'whatsapp', account);
    if (!organizationId) continue;
    known += 1;
    const outcome = await options.inOrganization(organizationId, async (db) => {
      const sender = await openChatSender(db, 'whatsapp', options);
      if (
        sender?.channel !== 'whatsapp' ||
        sender.account !== account ||
        !whatsAppSignatureIsValid(raw, signature, sender.appSecret)
      ) {
        return null;
      }
      const heard: ChatHeardMessage[] = [];
      for (const message of parseWhatsAppNotification(body, account)) {
        const kept = await hearChat(db, organizationId, message);
        if (kept) heard.push(kept);
      }
      let statuses = 0;
      for (const status of parseWhatsAppStatuses(body, account)) {
        if (await noteChatStatus(db, status)) statuses += 1;
      }
      return { heard, statuses };
    });
    if (!outcome) continue;
    vouched += 1;
    received.heard.push(...outcome.heard);
    received.statuses += outcome.statuses;
  }
  // An account of ours whose secret did not sign this: refused. An account nobody holds here has
  // no secret to be checked against: nothing is heard, and nothing is said of it.
  return known > 0 && vouched === 0 ? nothing(401) : received;
}

async function receiveBySecret(
  request: Request,
  options: ChatWebhookOptions,
): Promise<ChatReceived> {
  const account = options.account ?? '';
  const organizationId = account
    ? await organizationOfChatAccount(options.lookup, 'telegram', account)
    : null;
  if (!organizationId) return nothing(401);
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return nothing(400);
  }
  const heard = await options.inOrganization(organizationId, async (db) => {
    const sender = await openChatSender(db, 'telegram', options);
    if (sender?.channel !== 'telegram' || !telegramSecretIsValid(secret, sender.webhookSecret)) {
      return null;
    }
    const kept: ChatHeardMessage[] = [];
    for (const message of parseTelegramUpdate(body)) {
      const one = await hearChat(db, organizationId, message);
      if (one) kept.push(one);
    }
    return kept;
  });
  return heard ? { response: new Response('ok'), heard, statuses: 0 } : nothing(401);
}

/**
 * The whole webhook of a channel, for every organization of the deployment: finds whose
 * notification it is, checks it with that organization's own secret, keeps each message once and
 * notes each status. What a message means, and what to answer, is the app's: it reads `heard`,
 * queues its replies with `queueChatReply`, and delivers.
 */
export async function receiveChat(
  request: Request,
  options: ChatWebhookOptions,
): Promise<ChatReceived> {
  if (options.channel === 'whatsapp' && request.method === 'GET') {
    return options.verifyToken
      ? {
          response: verifyWhatsAppSubscription(new URL(request.url), options.verifyToken),
          heard: [],
          statuses: 0,
        }
      : nothing(403);
  }
  if (request.method !== 'POST') return nothing(405);
  return options.channel === 'whatsapp'
    ? receiveSigned(request, options)
    : receiveBySecret(request, options);
}
