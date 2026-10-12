import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  ChatChannelError,
  list,
  mediaTypeOf,
  record,
  text,
  type ChatChannel,
  type ChatHeard,
  type ChatInbound,
  type ChatSender,
  type Json,
} from './chat.js';

/**
 * The WhatsApp adapter (Meta's Cloud API), written from Firmo's and Nettio's. A webhook is
 * authenticated by the provider's signature over the raw body (X-Hub-Signature-256, the app
 * secret). Since 2026 a person may hide her phone number: the provider then names her by a
 * business-scoped user id, which this adapter reads and answers to.
 */
export interface WhatsAppOptions {
  accessToken: string;
  phoneNumberId: string;
  graphVersion?: string;
  fetch?: typeof fetch;
}

export interface WhatsAppWebhookOptions {
  /** The app secret that signs each notification. */
  appSecret: string;
  /** The token the provider repeats when it checks the subscription. */
  verifyToken: string;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** The provider's subscription check: echoes the challenge only for our verify token. */
export function verifyWhatsAppSubscription(url: URL, verifyToken: string): Response {
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token') ?? '';
  const challenge = url.searchParams.get('hub.challenge') ?? '';
  if (mode === 'subscribe' && safeEqual(token, verifyToken)) return new Response(challenge);
  return new Response(null, { status: 403 });
}

export function whatsAppSignatureIsValid(
  rawBody: string,
  header: string | null,
  appSecret: string,
): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`;
  return safeEqual(expected, header);
}

/**
 * A business-scoped user id: a country code, a period, then up to 128 letters and digits — with
 * « ENT. » after the country for a parent id. A phone number is digits only.
 */
const SCOPED_ID = /^[A-Z]{2}\.(?:ENT\.)?[A-Za-z0-9]{1,128}$/;

/** Where a message goes: to a phone number, or to a business-scoped id when that is all we have. */
function recipientOf(to: string): Json {
  return SCOPED_ID.test(to) ? { recipient: to } : { to };
}

/**
 * Who sent a message. The phone number comes when the provider gives it (`from`, or the contact's
 * `wa_id`); the scoped id (`from_user_id`, the contact's `user_id`) is the stable identifier.
 */
function senderOf(message: Json, contacts: Json[]): ChatSender | null {
  const phone = text(message.from);
  const scoped = text(message.from_user_id);
  const contact =
    contacts.find(
      (entry) =>
        (scoped !== null && text(entry.user_id) === scoped) ||
        (phone !== null && text(entry.wa_id) === phone),
    ) ?? (contacts.length === 1 ? contacts[0] : undefined);
  const id = scoped ?? text(contact?.user_id) ?? phone ?? text(contact?.wa_id);
  if (!id) return null;
  const number = phone ?? text(contact?.wa_id);
  const profile = record(contact?.profile);
  return {
    id,
    phone: number,
    // A phone number is preferred to answer: the provider keeps sending it while we use it.
    address: number ?? id,
    username: text(profile.username),
    displayName: text(profile.name),
  };
}

/** The messages of a verified notification; statuses and unknown events are ignored. */
export function parseWhatsAppNotification(body: unknown): ChatInbound[] {
  const messages: ChatInbound[] = [];
  for (const entry of list(record(body).entry)) {
    for (const change of list(entry.changes)) {
      const value = record(change.value);
      const contacts = list(value.contacts);
      for (const message of list(value.messages)) {
        const sender = senderOf(message, contacts);
        const id = text(message.id);
        if (!sender || !id) continue;
        const base = { channel: 'whatsapp' as const, providerMessageId: id, sender };
        const type = text(message.type);
        if (type === 'text') {
          messages.push({ ...base, kind: 'text', text: text(record(message.text).body) ?? '' });
        } else if (type === 'audio') {
          const audio = record(message.audio);
          messages.push({
            ...base,
            kind: 'voice',
            media: { id: text(audio.id) ?? '', mediaType: text(audio.mime_type), filename: null },
          });
        } else if (type === 'image') {
          const image = record(message.image);
          messages.push({
            ...base,
            kind: 'photo',
            text: text(image.caption),
            media: { id: text(image.id) ?? '', mediaType: text(image.mime_type), filename: null },
          });
        } else if (type === 'document') {
          const document = record(message.document);
          messages.push({
            ...base,
            kind: 'document',
            text: text(document.caption),
            media: {
              id: text(document.id) ?? '',
              mediaType: text(document.mime_type),
              filename: text(document.filename),
            },
          });
        } else if (type === 'interactive') {
          const interactive = record(message.interactive);
          // A reply button, or a row chosen in a list.
          const reply = record(interactive.button_reply ?? interactive.list_reply);
          messages.push({ ...base, kind: 'action', action: text(reply.id) ?? '' });
        } else if (type === 'button') {
          messages.push({
            ...base,
            kind: 'action',
            action: text(record(message.button).payload) ?? '',
          });
        } else {
          messages.push({ ...base, kind: 'unsupported' });
        }
      }
    }
  }
  return messages;
}

/**
 * The whole webhook: the subscription check on GET, a signed notification on POST. An unsigned or
 * unreadable notification hears nothing and is refused.
 */
export async function receiveWhatsApp(
  request: Request,
  options: WhatsAppWebhookOptions,
): Promise<ChatHeard> {
  if (request.method === 'GET') {
    return {
      response: verifyWhatsAppSubscription(new URL(request.url), options.verifyToken),
      messages: [],
    };
  }
  if (request.method !== 'POST')
    return { response: new Response(null, { status: 405 }), messages: [] };
  const raw = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  if (!whatsAppSignatureIsValid(raw, signature, options.appSecret)) {
    return { response: new Response(null, { status: 401 }), messages: [] };
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { response: new Response(null, { status: 400 }), messages: [] };
  }
  return { response: new Response('ok'), messages: parseWhatsAppNotification(body) };
}

/** Why the provider refused, from its error code. */
function refusal(status: number, body: Json): ChatChannelError {
  const code = Number(record(body.error).code ?? 0);
  // 131047: a business writing first outside the 24-hour window.
  if (code === 131047) return new ChatChannelError('outside_window', `whatsapp ${code}`);
  if (code === 131026 || code === 131030) {
    return new ChatChannelError('recipient_unreachable', `whatsapp ${code}`);
  }
  // 131062: this kind of message cannot go to a business-scoped id.
  if (code === 131062) return new ChatChannelError('needs_phone_number', `whatsapp ${code}`);
  return new ChatChannelError('provider_refused', `whatsapp ${status} ${code}`);
}

export function whatsAppChannel(options: WhatsAppOptions): ChatChannel {
  const http = options.fetch ?? fetch;
  const graph = `https://graph.facebook.com/${options.graphVersion ?? 'v25.0'}`;
  const auth = { authorization: `Bearer ${options.accessToken}` };

  async function call(path: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await http(`${graph}/${path}`, init);
    } catch {
      throw new ChatChannelError('network');
    }
    if (!response.ok) {
      throw refusal(response.status, record(await response.json().catch(() => ({}))));
    }
    return response;
  }

  const send = (to: string, payload: Json): Promise<Response> =>
    call(`${options.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        ...recipientOf(to),
        ...payload,
      }),
    });

  return {
    channel: 'whatsapp',
    async sendText(to, body, actions) {
      if (!actions?.length) {
        await send(to, { type: 'text', text: { body, preview_url: true } });
        return;
      }
      // An interactive message's text is 1 024 characters at most: a longer one goes first.
      let shown = body;
      if (body.length > 1024) {
        await send(to, { type: 'text', text: { body, preview_url: true } });
        shown = '…';
      }
      await send(to, {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: shown },
          action: {
            // Three buttons at most, titles of twenty characters at most.
            buttons: actions.slice(0, 3).map((action) => ({
              type: 'reply',
              reply: { id: action.id, title: action.label.slice(0, 20) },
            })),
          },
        },
      });
    },
    async sendTemplate(to, template) {
      await send(to, {
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language },
          components: [
            {
              type: 'body',
              parameters: template.parameters.map((value) => ({ type: 'text', text: value })),
            },
          ],
        },
      });
    },
    async sendDocument(to, content, filename, caption) {
      const mediaType = mediaTypeOf(filename);
      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('type', mediaType);
      form.append('file', new Blob([new Uint8Array(content)], { type: mediaType }), filename);
      const uploaded = await call(`${options.phoneNumberId}/media`, {
        method: 'POST',
        headers: auth,
        body: form,
      });
      const { id } = (await uploaded.json()) as { id: string };
      await send(to, { type: 'document', document: { id, filename, caption } });
    },
    async sendList(to, body, buttonLabel, rows) {
      // Ten rows at most; a title of 24 characters, a description of 72.
      await send(to, {
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: body.slice(0, 1024) },
          action: {
            button: buttonLabel.slice(0, 20),
            sections: [
              {
                title: buttonLabel.slice(0, 24),
                rows: rows.slice(0, 10).map((row) => ({
                  id: row.id,
                  title: row.title.slice(0, 24),
                  description: row.description.slice(0, 72),
                })),
              },
            ],
          },
        },
      });
    },
    async askForContact(to, body) {
      // The sender usually is the number already: a plain question, answered in words.
      await send(to, { type: 'text', text: { body } });
    },
    async download(media) {
      const meta = await call(media.id, { headers: auth });
      const { url, mime_type: mediaType } = (await meta.json()) as {
        url: string;
        mime_type: string;
      };
      let file: Response;
      try {
        file = await http(url, { headers: auth });
      } catch {
        throw new ChatChannelError('network');
      }
      if (!file.ok) throw new ChatChannelError('provider_refused', `whatsapp media ${file.status}`);
      return { bytes: new Uint8Array(await file.arrayBuffer()), mediaType };
    },
    typing(message) {
      // Marks her message read and shows the indicator (25 seconds at most, so it is renewed).
      const show = () =>
        void http(`${graph}/${options.phoneNumberId}/messages`, {
          method: 'POST',
          headers: { ...auth, 'content-type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: message.providerMessageId,
            typing_indicator: { type: 'text' },
          }),
        }).catch(() => undefined);
      show();
      const timer = setInterval(show, 20_000);
      return () => clearInterval(timer);
    },
  };
}
