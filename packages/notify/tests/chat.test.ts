import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ChatChannelError,
  memoryChatChannel,
  parseTelegramUpdate,
  parseWhatsAppNotification,
  parseWhatsAppStatuses,
  receiveTelegram,
  receiveWhatsApp,
  telegramChannel,
  whatsAppAccountsOf,
  whatsAppChannel,
  wordsOf,
  type ChatInbound,
} from '../src/index.js';

// The payloads are the providers' documented shapes, with invented people. Nothing here reaches a
// live service: every call goes to a recorded answer.

interface Call {
  url: string;
  init: RequestInit;
}

/** Answers each call in turn, and keeps what was asked. */
function recorded(...answers: { status?: number; body: unknown }[]) {
  const calls: Call[] = [];
  let index = 0;
  const fn = ((url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const answer = answers[Math.min(index, answers.length - 1)] ?? { body: {} };
    index += 1;
    return Promise.resolve(
      new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 }),
    );
  }) as unknown as typeof fetch;
  const sent = (at: number) => JSON.parse(String(calls[at]?.init.body)) as Record<string, unknown>;
  return { fn, calls, sent };
}

/** A notification as the provider wraps it. */
const notification = (value: Record<string, unknown>) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '1',
      changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', ...value } }],
    },
  ],
});

const SECRET = 'app-secret-of-the-test';
const signed = (raw: string) =>
  `sha256=${createHmac('sha256', SECRET).update(raw, 'utf8').digest('hex')}`;

describe('hearing WhatsApp', () => {
  it('reads a text with the phone number, as before', () => {
    const [heard] = parseWhatsAppNotification(
      notification({
        contacts: [{ profile: { name: 'Mme Adjovi' }, wa_id: '22890123456' }],
        messages: [{ from: '22890123456', id: 'wamid.A', type: 'text', text: { body: 'Bonjour' } }],
      }),
    );
    expect(heard).toEqual({
      channel: 'whatsapp',
      providerMessageId: 'wamid.A',
      sender: {
        id: '22890123456',
        phone: '22890123456',
        address: '22890123456',
        username: null,
        displayName: 'Mme Adjovi',
      },
      kind: 'text',
      text: 'Bonjour',
    });
  });

  it('keeps both identifiers when the provider gives the number and the scoped id', () => {
    const [heard] = parseWhatsAppNotification(
      notification({
        contacts: [
          {
            profile: { name: 'Mme Adjovi' },
            wa_id: '22890123456',
            user_id: 'TG.13491208655302741918',
          },
        ],
        messages: [
          {
            from: '22890123456',
            from_user_id: 'TG.13491208655302741918',
            id: 'wamid.B',
            type: 'text',
            text: { body: 'Mon dépôt est prêt ?' },
          },
        ],
      }),
    );
    // The scoped id is the stable one; the number still answers and still finds her.
    expect(heard?.sender).toMatchObject({
      id: 'TG.13491208655302741918',
      phone: '22890123456',
      address: '22890123456',
    });
  });

  it('hears a person whose number is hidden: no « from », a scoped id, a username', () => {
    const [heard] = parseWhatsAppNotification(
      notification({
        contacts: [
          {
            profile: { name: 'Sheena Nelson', username: 'sheena' },
            user_id: 'US.13491208655302741918',
          },
        ],
        messages: [
          {
            from_user_id: 'US.13491208655302741918',
            id: 'wamid.C',
            timestamp: '1749416383',
            type: 'text',
            text: { body: 'Does it come in another color?' },
          },
        ],
      }),
    );
    expect(heard?.sender).toEqual({
      id: 'US.13491208655302741918',
      phone: null,
      address: 'US.13491208655302741918',
      username: 'sheena',
      displayName: 'Sheena Nelson',
    });
    expect(heard?.text).toBe('Does it come in another color?');
  });

  it('reads a voice note, a photo, a document and a pressed button; ignores statuses', () => {
    const from = '22890123456';
    const heard = parseWhatsAppNotification(
      notification({
        contacts: [{ profile: { name: 'Kofi' }, wa_id: from }],
        statuses: [{ id: 'wamid.X', status: 'delivered', recipient_id: from }],
        messages: [
          { from, id: 'w1', type: 'audio', audio: { id: 'm1', mime_type: 'audio/ogg' } },
          {
            from,
            id: 'w2',
            type: 'image',
            image: { id: 'm2', mime_type: 'image/jpeg', caption: 'la tache' },
          },
          {
            from,
            id: 'w3',
            type: 'document',
            document: { id: 'm3', mime_type: 'application/pdf', filename: 'devis.pdf' },
          },
          { from, id: 'w4', type: 'interactive', interactive: { button_reply: { id: 'approve' } } },
          { from, id: 'w5', type: 'button', button: { payload: 'refuse' } },
          { from, id: 'w6', type: 'sticker', sticker: { id: 'm6' } },
        ],
      }),
    );
    expect(heard.map((message) => message.kind)).toEqual([
      'voice',
      'photo',
      'document',
      'action',
      'action',
      'unsupported',
    ]);
    expect(heard[1]).toMatchObject({
      text: 'la tache',
      media: { id: 'm2', mediaType: 'image/jpeg' },
    });
    expect(heard[2]?.media).toEqual({
      id: 'm3',
      mediaType: 'application/pdf',
      filename: 'devis.pdf',
    });
    expect(heard[3]?.action).toBe('approve');
    expect(heard[4]?.action).toBe('refuse');
  });

  it('answers the subscription check only for its token, and refuses an unsigned notification', async () => {
    const options = { appSecret: SECRET, verifyToken: 'verify-me' };
    const check = (token: string) =>
      receiveWhatsApp(
        new Request(
          `https://app.test/hook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=4242`,
        ),
        options,
      );
    const ok = await check('verify-me');
    expect(ok.response.status).toBe(200);
    expect(await ok.response.text()).toBe('4242');
    expect((await check('another')).response.status).toBe(403);

    const raw = JSON.stringify(
      notification({
        messages: [{ from: '22890123456', id: 'wamid.D', type: 'text', text: { body: 'Oui' } }],
      }),
    );
    const post = (signature: string | null, body = raw) =>
      receiveWhatsApp(
        new Request('https://app.test/hook', {
          method: 'POST',
          body,
          headers: signature ? { 'x-hub-signature-256': signature } : {},
        }),
        options,
      );
    const heard = await post(signed(raw));
    expect(heard.response.status).toBe(200);
    expect(heard.messages).toHaveLength(1);
    // Forged, missing, or signed for another body: nothing is heard.
    for (const forged of [null, 'sha256=00', signed(`${raw} `)]) {
      const refused = await post(forged);
      expect(refused.response.status).toBe(401);
      expect(refused.messages).toEqual([]);
    }
    expect((await post(signed('not json'), 'not json')).response.status).toBe(400);
    expect(
      (await receiveWhatsApp(new Request('https://app.test/hook', { method: 'PUT' }), options))
        .response.status,
    ).toBe(405);
  });
});

describe('what WhatsApp says of a message that left', () => {
  const body = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: '1055' },
              statuses: [
                {
                  id: 'wamid.1',
                  status: 'delivered',
                  pricing: { billable: true, pricing_model: 'PMP', category: 'utility' },
                },
                { id: 'wamid.2', status: 'failed', errors: [{ code: 131047 }] },
                { id: 'wamid.3', status: 'deleted' },
              ],
            },
          },
          {
            value: {
              metadata: { phone_number_id: '2066' },
              statuses: [{ id: 'wamid.9', status: 'read' }],
            },
          },
        ],
      },
    ],
  };

  it('reads where it is, whether it was billed, and why it failed', () => {
    expect(parseWhatsAppStatuses(body, '1055')).toEqual([
      {
        providerMessageId: 'wamid.1',
        status: 'delivered',
        reason: null,
        billable: true,
        category: 'utility',
      },
      {
        providerMessageId: 'wamid.2',
        status: 'failed',
        reason: 'outside_window',
        billable: null,
        category: null,
      },
    ]);
  });

  it('tells the accounts a notification names, and keeps to one when asked', () => {
    expect(whatsAppAccountsOf(body)).toEqual(['1055', '2066']);
    expect(parseWhatsAppStatuses(body, '2066')).toMatchObject([{ providerMessageId: 'wamid.9' }]);
    expect(parseWhatsAppStatuses(body)).toHaveLength(3);
  });
});

describe('writing on WhatsApp', () => {
  const options = { accessToken: 'token-of-the-test', phoneNumberId: '1055' };

  it('sends a text to a phone number, and to a scoped id through « recipient »', async () => {
    const http = recorded({ body: { messages: [{ id: 'wamid.1' }] } });
    const channel = whatsAppChannel({ ...options, fetch: http.fn });
    await channel.sendText('22890123456', 'Votre dépôt est prêt.');
    await channel.sendText('TG.13491208655302741918', 'Votre dépôt est prêt.');
    expect(http.calls[0]?.url).toBe('https://graph.facebook.com/v25.0/1055/messages');
    expect(new Headers(http.calls[0]?.init.headers).get('authorization')).toBe(
      'Bearer token-of-the-test',
    );
    expect(http.sent(0)).toMatchObject({
      to: '22890123456',
      type: 'text',
      text: { body: 'Votre dépôt est prêt.' },
    });
    expect(http.sent(1)).toMatchObject({ recipient: 'TG.13491208655302741918', type: 'text' });
    expect(http.sent(1)).not.toHaveProperty('to');
  });

  it('answers with the provider’s identifier of the message, which a status names later', async () => {
    const http = recorded({ body: { messages: [{ id: 'wamid.1' }] } });
    const channel = whatsAppChannel({ ...options, fetch: http.fn });
    expect(await channel.sendText('22890123456', 'Votre dépôt est prêt.')).toEqual({
      providerMessageId: 'wamid.1',
    });
    const silent = whatsAppChannel({ ...options, fetch: recorded({ body: {} }).fn });
    expect(await silent.sendText('22890123456', 'Votre dépôt est prêt.')).toBeUndefined();
  });

  it('shows three buttons at most, twenty characters each, and sends a long text first', async () => {
    const http = recorded({ body: {} });
    const channel = whatsAppChannel({ ...options, fetch: http.fn });
    const actions = [
      'Approuver',
      'Refuser',
      'Demander une précision au demandeur',
      'Plus tard',
    ].map((label, index) => ({ id: `a${index}`, label }));
    await channel.sendText('22890123456', 'x'.repeat(1100), actions);
    expect(http.calls).toHaveLength(2);
    expect(http.sent(0)).toMatchObject({ type: 'text' });
    const interactive = http.sent(1).interactive as {
      body: { text: string };
      action: { buttons: { reply: { title: string } }[] };
    };
    expect(interactive.body.text).toBe('…');
    expect(interactive.action.buttons.map((button) => button.reply.title)).toEqual([
      'Approuver',
      'Refuser',
      'Demander une précisi',
    ]);
  });

  it('sends an approved template with its values in order', async () => {
    const http = recorded({ body: {} });
    const channel = whatsAppChannel({ ...options, fetch: http.fn });
    await channel.sendTemplate?.('22890123456', {
      name: 'depot_pret',
      language: 'fr',
      parameters: ['A-0412', 'Agoè'],
    });
    expect(http.sent(0)).toMatchObject({
      type: 'template',
      template: {
        name: 'depot_pret',
        language: { code: 'fr' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'A-0412' },
              { type: 'text', text: 'Agoè' },
            ],
          },
        ],
      },
    });
  });

  it('uploads a document with the type its name announces, then sends it', async () => {
    const http = recorded({ body: { id: 'media-7' } }, { body: {} });
    const channel = whatsAppChannel({ ...options, fetch: http.fn });
    await channel.sendDocument(
      '22890123456',
      new Uint8Array([1, 2, 3]),
      'devis.pdf',
      'Votre devis',
    );
    expect(http.calls[0]?.url).toBe('https://graph.facebook.com/v25.0/1055/media');
    const form = http.calls[0]?.init.body as FormData;
    expect(form.get('type')).toBe('application/pdf');
    expect(http.sent(1)).toMatchObject({
      type: 'document',
      document: { id: 'media-7', filename: 'devis.pdf', caption: 'Votre devis' },
    });
  });

  it('says why the provider refused, in words a product can act on', async () => {
    const refusedWith = async (code: number) => {
      const http = recorded({ status: 400, body: { error: { code } } });
      return whatsAppChannel({ ...options, fetch: http.fn })
        .sendText('22890123456', 'Bonjour')
        .catch((error: unknown) => error);
    };
    expect(await refusedWith(131047)).toMatchObject({
      name: 'ChatChannelError',
      reason: 'outside_window',
    });
    expect(await refusedWith(131026)).toMatchObject({ reason: 'recipient_unreachable' });
    expect(await refusedWith(131062)).toMatchObject({ reason: 'needs_phone_number' });
    expect(await refusedWith(100)).toMatchObject({ reason: 'provider_refused' });
    const down = whatsAppChannel({
      ...options,
      fetch: (() => Promise.reject(new Error('socket hang up'))) as unknown as typeof fetch,
    });
    const error = await down.sendText('22890123456', 'Bonjour').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ChatChannelError);
    expect(error).toMatchObject({ reason: 'network' });
    // The provider's words never leak a credential into the message.
    expect(String((error as Error).message)).not.toContain('token-of-the-test');
  });
});

describe('hearing Telegram', () => {
  const from = { id: 777, first_name: 'Awa', last_name: 'Mensah', username: 'awa_m' };
  const chat = { id: 777, type: 'private' };

  it('reads a text in a private chat, with who she is', () => {
    const [heard] = parseTelegramUpdate({
      update_id: 1,
      message: { message_id: 12, from, chat, text: '/start abc' },
    });
    expect(heard).toEqual({
      channel: 'telegram',
      providerMessageId: '777:12',
      sender: {
        id: '777',
        phone: null,
        address: '777',
        username: 'awa_m',
        displayName: 'Awa Mensah',
      },
      kind: 'text',
      text: '/start abc',
    });
  });

  it('says whether a shared number is her own', () => {
    const own = parseTelegramUpdate({
      message: {
        message_id: 13,
        from,
        chat,
        contact: { phone_number: '+22890123456', user_id: 777 },
      },
    });
    expect(own[0]).toMatchObject({
      kind: 'contact',
      contact: { phoneNumber: '+22890123456', own: true },
    });
    const other = parseTelegramUpdate({
      message: {
        message_id: 14,
        from,
        chat,
        contact: { phone_number: '+22899999999', user_id: 5 },
      },
    });
    expect(other[0]?.contact).toEqual({ phoneNumber: '+22899999999', own: false });
  });

  it('reads a voice note, the largest photo, a document and a pressed button', () => {
    const one = (message: Record<string, unknown>) =>
      parseTelegramUpdate({ message: { message_id: 20, from, chat, ...message } })[0];
    expect(one({ voice: { file_id: 'v1' } })).toMatchObject({
      kind: 'voice',
      media: { id: 'v1', mediaType: 'audio/ogg' },
    });
    expect(
      one({ photo: [{ file_id: 'small' }, { file_id: 'large' }], caption: 'la tache' }),
    ).toMatchObject({
      kind: 'photo',
      text: 'la tache',
      media: { id: 'large' },
    });
    expect(
      one({ document: { file_id: 'd1', file_name: 'devis.pdf', mime_type: 'application/pdf' } }),
    ).toMatchObject({
      kind: 'document',
      media: { id: 'd1', filename: 'devis.pdf', mediaType: 'application/pdf' },
    });
    expect(one({ sticker: { file_id: 's1' } })?.kind).toBe('unsupported');
    const [pressed] = parseTelegramUpdate({
      callback_query: { id: 'cb9', from, message: { chat }, data: 'approve' },
    });
    expect(pressed).toMatchObject({
      providerMessageId: 'cb:cb9',
      kind: 'action',
      action: 'approve',
    });
  });

  it('ignores a group, and a chat that is not the sender’s own', () => {
    expect(
      parseTelegramUpdate({
        message: { message_id: 1, from, chat: { id: -100, type: 'group' }, text: 'hi' },
      }),
    ).toEqual([]);
    expect(
      parseTelegramUpdate({
        message: { message_id: 1, from, chat: { id: 778, type: 'private' }, text: 'hi' },
      }),
    ).toEqual([]);
    expect(
      parseTelegramUpdate({ edited_message: { message_id: 1, from, chat, text: 'hi' } }),
    ).toEqual([]);
  });

  it('hears a webhook only with Telegram’s secret', async () => {
    const options = { webhookSecret: 'secret-of-the-test' };
    const post = (secret: string | null) =>
      receiveTelegram(
        new Request('https://app.test/hook', {
          method: 'POST',
          body: JSON.stringify({ message: { message_id: 12, from, chat, text: 'Bonjour' } }),
          headers: secret ? { 'x-telegram-bot-api-secret-token': secret } : {},
        }),
        options,
      );
    expect((await post('secret-of-the-test')).messages).toHaveLength(1);
    for (const wrong of [null, 'another-secret-value']) {
      const refused = await post(wrong);
      expect(refused.response.status).toBe(401);
      expect(refused.messages).toEqual([]);
    }
    expect(
      (await receiveTelegram(new Request('https://app.test/hook'), options)).response.status,
    ).toBe(405);
  });
});

describe('writing on Telegram', () => {
  it('sends a text with its buttons, a list, and asks for her number', async () => {
    const http = recorded({ body: { ok: true, result: {} } });
    const channel = telegramChannel({ botToken: '42:bot-token-of-the-test', fetch: http.fn });
    await channel.sendText('777', 'Approuver l’achat ?', [{ id: 'approve', label: 'Oui' }]);
    await channel.sendText('777', 'Merci.');
    await channel.askForContact?.('777', 'Votre numéro ?', 'Partager mon numéro');
    expect(http.calls[0]?.url).toBe(
      'https://api.telegram.org/bot42:bot-token-of-the-test/sendMessage',
    );
    expect(http.sent(0)).toMatchObject({
      chat_id: '777',
      reply_markup: { inline_keyboard: [[{ text: 'Oui', callback_data: 'approve' }]] },
    });
    expect(http.sent(1)).toMatchObject({ reply_markup: { remove_keyboard: true } });
    expect(http.sent(2)).toMatchObject({
      reply_markup: { keyboard: [[{ text: 'Partager mon numéro', request_contact: true }]] },
    });
  });

  it('names a message that left by its chat and its number in that chat', async () => {
    const http = recorded({ body: { ok: true, result: { message_id: 31 } } });
    const channel = telegramChannel({ botToken: '42:bot-token-of-the-test', fetch: http.fn });
    expect(await channel.sendText('777', 'Merci.')).toEqual({ providerMessageId: '777:31' });
  });

  it('says she is unreachable when she blocked the bot, and never shows the bot’s token', async () => {
    const http = recorded({
      status: 403,
      body: { ok: false, description: 'Forbidden: bot was blocked by the user' },
    });
    const channel = telegramChannel({ botToken: '42:bot-token-of-the-test', fetch: http.fn });
    const error = await channel.sendText('777', 'Bonjour').catch((caught: unknown) => caught);
    expect(error).toMatchObject({ name: 'ChatChannelError', reason: 'recipient_unreachable' });
    expect(String((error as Error).message)).not.toContain('bot-token-of-the-test');
    const refused = recorded({ status: 400, body: { ok: false } });
    await expect(
      telegramChannel({ botToken: '42:x', fetch: refused.fn }).sendText('777', 'Bonjour'),
    ).rejects.toMatchObject({ reason: 'provider_refused' });
  });
});

describe('a channel in memory, for an app’s own tests', () => {
  it('keeps what would have left', async () => {
    const channel = memoryChatChannel('whatsapp');
    await channel.sendText('22890123456', 'Bonjour');
    await channel.sendDocument('22890123456', new Uint8Array(3), 'devis.pdf', 'Votre devis');
    await channel.sendTemplate?.('22890123456', {
      name: 'depot_pret',
      language: 'fr',
      parameters: [],
    });
    expect(channel.sent.map((message) => message.kind)).toEqual(['text', 'document', 'template']);
    expect(channel.sent[1]).toMatchObject({ filename: 'devis.pdf', bytes: 3 });
  });
});

describe('the words of a message (spec 104)', () => {
  const sender = {
    id: '22890123456',
    phone: '22890123456',
    address: '22890123456',
    username: null,
    displayName: 'Afi',
  };
  const base = { channel: 'whatsapp' as const, providerMessageId: 'wamid.1', sender };
  const fetched: string[] = [];
  const channel = {
    download: async (media: { id: string }) => {
      fetched.push(media.id);
      return { bytes: new Uint8Array([1, 2, 3]), mediaType: 'audio/ogg' };
    },
  };
  const dictate = async (audio: Uint8Array) => ({
    text: audio.length ? '  Fini le devis de la Pharmacie.  ' : '',
  });

  it('reads a text as it is, and a voice note written down by the dictation port', async () => {
    const text: ChatInbound = { ...base, kind: 'text', text: ' Relancer Ecobank jeudi ' };
    expect(await wordsOf(text, { channel, dictate })).toEqual({
      text: 'Relancer Ecobank jeudi',
      from: 'text',
    });
    const voice: ChatInbound = {
      ...base,
      kind: 'voice',
      media: { id: 'media-7', mediaType: 'audio/ogg', filename: null },
    };
    expect(await wordsOf(voice, { channel, dictate })).toEqual({
      text: 'Fini le devis de la Pharmacie.',
      from: 'voice',
    });
    expect(fetched).toEqual(['media-7']);
  });

  it('has no words for a photo, nor for a voice note nothing could hear', async () => {
    const photo: ChatInbound = {
      ...base,
      kind: 'photo',
      media: { id: 'm', mediaType: 'image/jpeg', filename: null },
    };
    expect(await wordsOf(photo, { channel, dictate })).toBeNull();
    const silent: ChatInbound = {
      ...base,
      kind: 'voice',
      media: { id: 'm2', mediaType: 'audio/ogg', filename: null },
    };
    expect(await wordsOf(silent, { channel, dictate: async () => ({ text: ' ' }) })).toBeNull();
    expect(await wordsOf(silent, { channel: {}, dictate })).toBeNull();
  });
});
