import { timingSafeEqual } from 'node:crypto';
import {
  ChatChannelError,
  mediaTypeOf,
  record,
  text,
  type ChatChannel,
  type ChatHeard,
  type ChatInbound,
  type ChatReceipt,
  type ChatSender,
  type Json,
} from './chat.js';

/**
 * The Telegram adapter (Bot API), written from Firmo's and Nettio's. A webhook is authenticated by
 * the secret token Telegram echoes in X-Telegram-Bot-Api-Secret-Token; only private chats are
 * accepted, so the chat is the sender. A bot cannot write first: a person opens it herself.
 */
export interface TelegramOptions {
  botToken: string;
  fetch?: typeof fetch;
}

export interface TelegramWebhookOptions {
  /** The secret given to Telegram when the webhook was set. */
  webhookSecret: string;
}

export function telegramSecretIsValid(header: string | null, secret: string): boolean {
  if (!header) return false;
  const left = Buffer.from(header);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

function senderOf(from: Json): ChatSender | null {
  const id = text(from.id);
  if (!id) return null;
  const name = [from.first_name, from.last_name]
    .filter((part) => typeof part === 'string' && part !== '')
    .join(' ');
  return {
    id,
    // Telegram never gives a number by itself: she shares it, as a contact.
    phone: null,
    address: id,
    username: text(from.username),
    displayName: name || null,
  };
}

/** The message of a verified update; anything but a private chat is ignored. */
export function parseTelegramUpdate(body: unknown): ChatInbound[] {
  const update = record(body);
  const callback = record(update.callback_query);
  if (callback.id) {
    const from = record(callback.from);
    const chat = record(record(callback.message).chat);
    const sender = senderOf(from);
    if (!sender || chat.type !== 'private' || text(chat.id) !== sender.id) return [];
    return [
      {
        channel: 'telegram',
        providerMessageId: `cb:${text(callback.id) ?? ''}`,
        sender,
        kind: 'action',
        action: text(callback.data) ?? '',
      },
    ];
  }
  const message = record(update.message);
  const chat = record(message.chat);
  const sender = senderOf(record(message.from));
  const messageId = text(message.message_id);
  if (!sender || !messageId || chat.type !== 'private' || text(chat.id) !== sender.id) return [];
  const base = {
    channel: 'telegram' as const,
    providerMessageId: `${sender.id}:${messageId}`,
    sender,
  };
  if (message.contact) {
    const contact = record(message.contact);
    return [
      {
        ...base,
        kind: 'contact',
        contact: {
          phoneNumber: text(contact.phone_number) ?? '',
          // Telegram says whose number it is: only her own proves her.
          own: text(contact.user_id) === sender.id,
        },
      },
    ];
  }
  if (typeof message.text === 'string') return [{ ...base, kind: 'text', text: message.text }];
  const voice = record(message.voice ?? message.audio);
  if (voice.file_id) {
    return [
      {
        ...base,
        kind: 'voice',
        media: {
          id: text(voice.file_id) ?? '',
          mediaType: text(voice.mime_type) ?? 'audio/ogg',
          filename: null,
        },
      },
    ];
  }
  if (Array.isArray(message.photo) && message.photo.length > 0) {
    const largest = record(message.photo[message.photo.length - 1]);
    return [
      {
        ...base,
        kind: 'photo',
        text: text(message.caption),
        media: { id: text(largest.file_id) ?? '', mediaType: 'image/jpeg', filename: null },
      },
    ];
  }
  const document = record(message.document);
  if (document.file_id) {
    return [
      {
        ...base,
        kind: 'document',
        text: text(message.caption),
        media: {
          id: text(document.file_id) ?? '',
          mediaType: text(document.mime_type),
          filename: text(document.file_name),
        },
      },
    ];
  }
  return [{ ...base, kind: 'unsupported' }];
}

/** The whole webhook: a POST carrying Telegram's secret. Anything else hears nothing. */
export async function receiveTelegram(
  request: Request,
  options: TelegramWebhookOptions,
): Promise<ChatHeard> {
  if (request.method !== 'POST')
    return { response: new Response(null, { status: 405 }), messages: [] };
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  if (!telegramSecretIsValid(secret, options.webhookSecret)) {
    return { response: new Response(null, { status: 401 }), messages: [] };
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: new Response(null, { status: 400 }), messages: [] };
  }
  return { response: new Response('ok'), messages: parseTelegramUpdate(body) };
}

export function telegramChannel(options: TelegramOptions): ChatChannel {
  const http = options.fetch ?? fetch;
  const api = `https://api.telegram.org/bot${options.botToken}`;

  async function call(method: string, payload: Json | FormData): Promise<Json> {
    let response: Response;
    try {
      response = await http(`${api}/${method}`, {
        method: 'POST',
        ...(payload instanceof FormData
          ? { body: payload }
          : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }),
      });
    } catch {
      throw new ChatChannelError('network');
    }
    const body = record(await response.json().catch(() => ({})));
    if (response.ok && body.ok === true) return record(body.result);
    // 403: she blocked the bot, or never opened it.
    throw new ChatChannelError(
      response.status === 403 ? 'recipient_unreachable' : 'provider_refused',
      `telegram ${method} ${response.status}`,
    );
  }

  // A message is numbered within its chat: the two together name it.
  const receipt = (to: string, result: Json): ChatReceipt | undefined => {
    const id = text(result.message_id);
    return id ? { providerMessageId: `${to}:${id}` } : undefined;
  };

  return {
    channel: 'telegram',
    async sendText(to, body, actions) {
      const result = await call('sendMessage', {
        chat_id: to,
        text: body,
        // Any number-sharing keyboard goes away once the conversation has started.
        reply_markup: actions?.length
          ? {
              inline_keyboard: [
                actions.map((action) => ({ text: action.label, callback_data: action.id })),
              ],
            }
          : { remove_keyboard: true },
      });
      return receipt(to, result);
    },
    async sendDocument(to, content, filename, caption) {
      const form = new FormData();
      form.append('chat_id', to);
      form.append('caption', caption);
      form.append(
        'document',
        new Blob([new Uint8Array(content)], { type: mediaTypeOf(filename) }),
        filename,
      );
      return receipt(to, await call('sendDocument', form));
    },
    async sendList(to, body, _buttonLabel, rows) {
      // One button per row, under the message.
      await call('sendMessage', {
        chat_id: to,
        text: body,
        reply_markup: {
          inline_keyboard: rows
            .slice(0, 10)
            .map((row) => [
              { text: `${row.title} — ${row.description}`.slice(0, 64), callback_data: row.id },
            ]),
        },
      });
    },
    async askForContact(to, body, buttonLabel) {
      await call('sendMessage', {
        chat_id: to,
        text: body,
        reply_markup: {
          keyboard: [[{ text: buttonLabel, request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      });
    },
    async download(media) {
      const file = await call('getFile', { file_id: media.id });
      const path = text(file.file_path) ?? '';
      let response: Response;
      try {
        response = await http(`https://api.telegram.org/file/bot${options.botToken}/${path}`);
      } catch {
        throw new ChatChannelError('network');
      }
      if (!response.ok) {
        throw new ChatChannelError('provider_refused', `telegram file ${response.status}`);
      }
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        mediaType: media.mediaType ?? 'application/octet-stream',
      };
    },
    async acknowledgeAction(message) {
      const id = message.providerMessageId.startsWith('cb:')
        ? message.providerMessageId.slice(3)
        : '';
      if (id) await call('answerCallbackQuery', { callback_query_id: id });
    },
    typing(message) {
      // Shown for five seconds: renewed until the product answers.
      const show = () =>
        void call('sendChatAction', { chat_id: message.sender.address, action: 'typing' }).catch(
          () => undefined,
        );
      show();
      const timer = setInterval(show, 4500);
      return () => clearInterval(timer);
    },
  };
}
