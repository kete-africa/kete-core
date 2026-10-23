import { createHmac, randomBytes } from 'node:crypto';
import { inOrganization, type SqlExecutor } from '@kete/tenancy';
import { createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ChatChannelError,
  chatChannelOf,
  chatContactOf,
  chatLinkTokenOf,
  chatOrganizationsWaiting,
  chatOutboxMigrationSql,
  chatUsage,
  connectChatSender,
  deliverChat,
  listChatMessages,
  listChatSenders,
  memoryChatChannel,
  organizationOfChatAccount,
  queueChatMessage,
  queueChatReply,
  queueChatText,
  receiveChat,
  requeueChatMessage,
  saveChatContact,
  saveChatTemplate,
  setChatConsent,
  type ChatChannel,
  type ChatSenderSecrets,
} from '../src/index.js';

// Spec 088: the outbox to people. Two laundries, each with its own number; a third without one.

let db: TestSchema;
const as = <T>(organizationId: string, work: (client: SqlExecutor) => Promise<T>) =>
  inOrganization(db.app, organizationId, work);

// A key of this run only; the words below stand for tokens, and are none.
const secretsKey = randomBytes(32).toString('base64');
const memory = new Map<string, ReturnType<typeof memoryChatChannel>>();
const flaky = new Map<string, ChatChannel>();
const connect = (sender: ChatSenderSecrets): ChatChannel => {
  const broken = flaky.get(sender.account);
  if (broken) return broken;
  const kept = memory.get(sender.account) ?? memoryChatChannel(sender.channel);
  memory.set(sender.account, kept);
  return kept;
};
const options = { secretsKey, connect };
const sentFrom = (account: string) => memory.get(account)?.sent ?? [];

const BLEU = 'org_bleu';
const VERT = 'org_vert';
const ROUGE = 'org_rouge';
const words = ['client', 'numero'] as const;
const ready = {
  kind: 'deposit.ready',
  enabled: true,
  body: 'Bonjour {client}, votre dépôt {numero} est prêt.',
};

/** A notification as the provider posts it, for the number of one account. */
const notification = (account: string, value: Record<string, unknown>) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'waba',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { phone_number_id: account },
            ...value,
          },
        },
      ],
    },
  ],
});
const wrote = (from: string, id: string, body: string) => ({
  contacts: [{ wa_id: from, profile: { name: 'Ama' } }],
  messages: [{ from, id, type: 'text', text: { body } }],
});
const signedBy = (appSecret: string, body: unknown) => {
  const raw = JSON.stringify(body);
  return new Request('https://app.example/webhooks/whatsapp', {
    method: 'POST',
    headers: {
      'x-hub-signature-256': `sha256=${createHmac('sha256', appSecret).update(raw).digest('hex')}`,
    },
    body: raw,
  });
};
const receive = (request: Request, channel: 'whatsapp' | 'telegram' = 'whatsapp', account = '') =>
  receiveChat(request, {
    ...options,
    channel,
    lookup: db.app,
    inOrganization: as,
    ...(account ? { account } : {}),
  });
const providerIdOf = async (messageId: string) => {
  const { rows } = await db.owner.query<{ provider_message_id: string }>(
    `select provider_message_id from kete_chat_messages where message_id = $1`,
    [messageId],
  );
  return rows[0]?.provider_message_id ?? '';
};

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(chatOutboxMigrationSql({ schema, appRole }));
    },
  });
  await as(BLEU, (client) =>
    connectChatSender(
      client,
      BLEU,
      {
        channel: 'whatsapp',
        phoneNumberId: '1001',
        accessToken: 'jeton-bleu',
        appSecret: 'secret-bleu',
        label: '+228 22 00 00 01',
      },
      options,
    ),
  );
  await as(VERT, (client) =>
    connectChatSender(
      client,
      VERT,
      {
        channel: 'whatsapp',
        phoneNumberId: '2002',
        accessToken: 'jeton-vert',
        appSecret: 'secret-vert',
      },
      options,
    ),
  );
});

afterAll(async () => {
  await db?.drop();
});

describe('a sender per organization', () => {
  it('seals its credentials: no token is readable in the database', async () => {
    const { rows } = await db.owner.query<{ credentials: string }>(
      `select credentials from kete_chat_senders`,
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.credentials.startsWith('v1.')).toBe(true);
      expect(row.credentials).not.toMatch(/jeton|secret/);
    }
    const senders = await as(BLEU, (client) => listChatSenders(client, options));
    expect(senders).toEqual([
      {
        channel: 'whatsapp',
        account: '1001',
        label: '+228 22 00 00 01',
        connectedAt: expect.any(String) as string,
        state: 'connected',
      },
    ]);
  });

  it('shows a sender sealed under another key as to reconnect, and opens nothing', async () => {
    const another = { secretsKey: randomBytes(32).toString('base64'), connect };
    await as(BLEU, async (client) => {
      expect((await listChatSenders(client, another))[0]?.state).toBe('to_reconnect');
      expect(await chatChannelOf(client, 'whatsapp', another)).toBeNull();
    });
  });

  it('refuses an account another organization connected, and a deployment without a key', async () => {
    const theirs = {
      channel: 'whatsapp' as const,
      phoneNumberId: '1001',
      accessToken: 'jeton-vert',
      appSecret: 'secret-vert',
    };
    await expect(
      as(VERT, (client) => connectChatSender(client, VERT, theirs, options)),
    ).rejects.toMatchObject({ code: 'account_taken' });
    await expect(
      as(ROUGE, (client) => connectChatSender(client, ROUGE, theirs, { secretsKey: 'none' })),
    ).rejects.toMatchObject({ code: 'secrets_off' });
  });

  it('answers across organizations with an identifier only', async () => {
    expect(await organizationOfChatAccount(db.app, 'whatsapp', '1001')).toBe(BLEU);
    expect(await organizationOfChatAccount(db.app, 'whatsapp', '2002')).toBe(VERT);
    expect(await organizationOfChatAccount(db.app, 'whatsapp', '9999')).toBeNull();
    // Outside any organization, the application role reads no row at all.
    const { rows } = await db.app.query(`select account from kete_chat_senders`);
    expect(rows).toEqual([]);
  });
});

describe('what may leave', () => {
  it('refuses a template that names what the app does not know', async () => {
    await expect(
      as(BLEU, (client) =>
        saveChatTemplate(client, BLEU, { ...ready, body: 'Bonjour {prenom}' }, words),
      ),
    ).rejects.toMatchObject({ code: 'template_unknown_placeholder', detail: 'prenom' });
  });

  it('keeps nothing for a kind the organization did not turn on', async () => {
    await as(BLEU, async (client) => {
      await saveChatContact(client, BLEU, { reference: 'cus_ama', phone: '+228 90 11 22 33' });
      await saveChatTemplate(client, BLEU, { ...ready, enabled: false }, words);
      const queued = await queueChatMessage(client, BLEU, {
        reference: 'cus_ama',
        kind: 'deposit.ready',
        values: { client: 'Ama', numero: 'A-0412' },
      });
      expect(queued).toEqual({ messageId: null, status: 'skipped', reason: 'template_off' });
      expect(await listChatMessages(client)).toEqual([]);
    });
  });

  it('skips a message for a contact who did not agree, and says why', async () => {
    await as(BLEU, async (client) => {
      await saveChatTemplate(client, BLEU, ready, words);
      const queued = await queueChatMessage(client, BLEU, {
        reference: 'cus_ama',
        kind: 'deposit.ready',
        values: { client: 'Ama', numero: 'A-0412' },
        subject: 'ord_0412',
      });
      expect(queued).toMatchObject({ status: 'skipped', reason: 'no_consent' });
      expect(await deliverChat(client, options)).toEqual({ sent: 0, failed: 0, retried: 0 });
      expect(await listChatMessages(client, { subject: 'ord_0412' })).toMatchObject([
        { reference: 'cus_ama', status: 'skipped', reason: 'no_consent', channel: 'whatsapp' },
      ]);
    });
    expect(sentFrom('1001')).toEqual([]);
  });

  it('skips a message of an organization without its own sender: never another’s', async () => {
    await as(ROUGE, async (client) => {
      await saveChatContact(client, ROUGE, { reference: 'cus_ama', phone: '22890112233' });
      await setChatConsent(client, 'cus_ama', true);
      await saveChatTemplate(client, ROUGE, ready, words);
      const queued = await queueChatMessage(client, ROUGE, {
        reference: 'cus_ama',
        kind: 'deposit.ready',
        values: { client: 'Ama', numero: 'R-0001' },
      });
      expect(queued).toMatchObject({ status: 'skipped', reason: 'not_connected' });
    });
    expect(sentFrom('1001')).toEqual([]);
    expect(sentFrom('2002')).toEqual([]);
  });
});

describe('a message leaves from its organization’s own number', () => {
  let sent = '';

  it('sends the organization’s words once she agreed', async () => {
    await as(BLEU, async (client) => {
      expect(await setChatConsent(client, 'cus_ama', true)).toBe(true);
      const queued = await queueChatMessage(client, BLEU, {
        reference: 'cus_ama',
        kind: 'deposit.ready',
        values: { client: 'Ama', numero: 'A-0412' },
        subject: 'ord_0412',
      });
      expect(queued).toMatchObject({ status: 'queued', reason: '' });
      sent = queued.messageId ?? '';
    });
    expect(await chatOrganizationsWaiting(db.app)).toEqual([BLEU]);
    expect(await as(BLEU, (client) => deliverChat(client, options))).toEqual({
      sent: 1,
      failed: 0,
      retried: 0,
    });
    expect(sentFrom('1001')).toEqual([
      {
        kind: 'text',
        to: '22890112233',
        text: 'Bonjour Ama, votre dépôt A-0412 est prêt.',
        actions: [],
      },
    ]);
    expect(sentFrom('2002')).toEqual([]);
    expect(await chatOrganizationsWaiting(db.app)).toEqual([]);
  });

  it('is unknown to the other organization', async () => {
    await as(VERT, async (client) => {
      expect(await listChatMessages(client)).toEqual([]);
      expect(await chatContactOf(client, 'cus_ama')).toBeNull();
    });
  });

  it('notes what the provider says of it, and what it cost', async () => {
    const status = notification('1001', {
      statuses: [
        {
          id: await providerIdOf(sent),
          status: 'delivered',
          pricing: { billable: true, pricing_model: 'PMP', category: 'utility' },
        },
      ],
    });
    const received = await receive(signedBy('secret-bleu', status));
    expect(received.response.status).toBe(200);
    expect(received.statuses).toBe(1);
    await as(BLEU, async (client) => {
      expect(await listChatMessages(client, { subject: 'ord_0412', limit: 1 })).toMatchObject([
        { status: 'delivered', billable: true, costCategory: 'utility' },
      ]);
      expect(await chatUsage(client, new Date().toISOString().slice(0, 7))).toEqual([
        { channel: 'whatsapp', category: 'utility', billable: true, count: 1 },
      ]);
    });
  });

  it('never hears in one organization a notification sent to another’s account', async () => {
    // Signed with the other laundry's secret: nobody vouches for it.
    const forged = await receive(
      signedBy(
        'secret-vert',
        notification('1001', wrote('22890112233', 'wamid.FORGED', 'Bonjour')),
      ),
    );
    expect(forged.response.status).toBe(401);
    expect(forged.heard).toEqual([]);
    // An account nobody holds here: nothing is heard, nothing is said.
    const stray = await receive(
      signedBy('secret-bleu', notification('9999', wrote('22890112233', 'wamid.STRAY', 'Bonjour'))),
    );
    expect(stray.response.status).toBe(200);
    expect(stray.heard).toEqual([]);
  });

  it('hears a message once, in the organization of its account, and answers her', async () => {
    const body = notification('1001', wrote('22890112233', 'wamid.A1', 'Où en est mon dépôt ?'));
    const first = await receive(signedBy('secret-bleu', body));
    expect(first.heard).toMatchObject([
      { organizationId: BLEU, reference: 'cus_ama', intent: 'message' },
    ]);
    const again = await receive(signedBy('secret-bleu', body));
    expect(again.response.status).toBe(200);
    expect(again.heard).toEqual([]);

    await as(BLEU, async (client) => {
      await queueChatReply(client, BLEU, {
        to: first.heard[0]?.messageId ?? '',
        text: 'Votre dépôt A-0412 est prêt.',
        actions: [{ id: 'thanks', label: 'Merci' }],
      });
      expect(await deliverChat(client, options)).toMatchObject({ sent: 1 });
    });
    expect(sentFrom('1001').at(-1)).toEqual({
      kind: 'text',
      to: '22890112233',
      text: 'Votre dépôt A-0412 est prêt.',
      actions: [{ id: 'thanks', label: 'Merci' }],
    });
    await as(VERT, async (client) => expect(await listChatMessages(client)).toEqual([]));
  });

  it('keeps the first message of a sender nobody knows, and can answer it', async () => {
    const received = await receive(
      signedBy('secret-bleu', notification('1001', wrote('22899000000', 'wamid.U1', 'Bonjour'))),
    );
    expect(received.heard).toMatchObject([{ contactId: null, reference: null, intent: 'message' }]);
    await as(BLEU, async (client) => {
      await queueChatReply(client, BLEU, {
        to: received.heard[0]?.messageId ?? '',
        text: 'Bonjour, qui êtes-vous ?',
      });
      await deliverChat(client, options);
    });
    expect(sentFrom('1001').at(-1)).toMatchObject({ to: '22899000000' });
  });
});

describe('the provider’s approved template', () => {
  const reminder = {
    kind: 'deposit.reminder',
    enabled: true,
    body: 'Bonjour {client}, votre dépôt {numero} vous attend.',
    providerTemplate: 'rappel_depot',
  };

  it('leaves as the template for someone who did not write in the last 24 hours', async () => {
    await as(VERT, async (client) => {
      await saveChatContact(client, VERT, { reference: 'cus_kossi', phone: '22891000001' });
      await setChatConsent(client, 'cus_kossi', true);
      await saveChatTemplate(client, VERT, reminder, words);
      await queueChatMessage(client, VERT, {
        reference: 'cus_kossi',
        kind: 'deposit.reminder',
        values: { client: 'Kossi', numero: 'V-0007' },
      });
      expect(await deliverChat(client, options)).toMatchObject({ sent: 1 });
    });
    expect(sentFrom('2002')).toEqual([
      {
        kind: 'template',
        to: '22891000001',
        template: { name: 'rappel_depot', language: 'fr', parameters: ['Kossi', 'V-0007'] },
      },
    ]);
    // The other laundry's number sent nothing more.
    expect(sentFrom('1001')).toHaveLength(3);
  });

  it('leaves in the organization’s own words, with buttons, once she wrote', async () => {
    await receive(
      signedBy('secret-vert', notification('2002', wrote('22891000001', 'wamid.K1', 'Merci'))),
    );
    await as(VERT, async (client) => {
      await queueChatMessage(client, VERT, {
        reference: 'cus_kossi',
        kind: 'deposit.reminder',
        values: { client: 'Kossi', numero: 'V-0007' },
        actions: [{ id: 'coming', label: 'Je passe' }],
        subject: 'ord_v7',
      });
      await deliverChat(client, options);
    });
    expect(sentFrom('2002').at(-1)).toEqual({
      kind: 'text',
      to: '22891000001',
      text: 'Bonjour Kossi, votre dépôt V-0007 vous attend.',
      actions: [{ id: 'coming', label: 'Je passe' }],
    });
  });

  it('leaves again as the template when the provider refuses the words afterwards', async () => {
    const [message] = await as(VERT, (client) => listChatMessages(client, { subject: 'ord_v7' }));
    const refused = notification('2002', {
      statuses: [
        {
          id: await providerIdOf(message?.messageId ?? ''),
          status: 'failed',
          errors: [{ code: 131047 }],
        },
      ],
    });
    expect((await receive(signedBy('secret-vert', refused))).statuses).toBe(1);
    await as(VERT, async (client) => {
      expect(await listChatMessages(client, { subject: 'ord_v7' })).toMatchObject([
        { status: 'queued' },
      ]);
      expect(await deliverChat(client, options)).toMatchObject({ sent: 1 });
    });
    expect(sentFrom('2002').at(-1)).toMatchObject({
      kind: 'template',
      template: { name: 'rappel_depot' },
    });
  });
});

describe('a message that does not go through', () => {
  const YELLOW = 'org_jaune';

  it('tries again later when the network failed, and keeps a refusal’s reason', async () => {
    let fails: ChatChannelError | null = new ChatChannelError('network');
    const sent: string[] = [];
    flaky.set('3003', {
      channel: 'whatsapp',
      sendText: (to) => {
        if (fails) return Promise.reject(fails);
        sent.push(to);
        return Promise.resolve();
      },
      sendDocument: () => Promise.resolve(),
    });
    const queue = (client: SqlExecutor, numero: string) =>
      queueChatMessage(client, YELLOW, {
        reference: 'cus_afi',
        kind: 'deposit.ready',
        values: { client: 'Afi', numero },
        subject: numero,
      });
    await as(YELLOW, async (client) => {
      await connectChatSender(
        client,
        YELLOW,
        { channel: 'whatsapp', phoneNumberId: '3003', accessToken: 'jeton-jaune', appSecret: 's' },
        options,
      );
      await saveChatContact(client, YELLOW, { reference: 'cus_afi', phone: '22892000002' });
      await setChatConsent(client, 'cus_afi', true);
      await saveChatTemplate(client, YELLOW, ready, words);
      await queue(client, 'J-1');
      expect(await deliverChat(client, options)).toEqual({ sent: 0, failed: 0, retried: 1 });
      // Not due yet: nothing is tried.
      expect(await deliverChat(client, options)).toEqual({ sent: 0, failed: 0, retried: 0 });
      expect(await listChatMessages(client, { subject: 'J-1' })).toMatchObject([
        { status: 'queued', reason: 'network', attempts: 1 },
      ]);
    });
    await db.owner.query(
      `update kete_chat_messages set next_attempt_at = now() where subject = 'J-1'`,
    );
    fails = null;
    await as(YELLOW, async (client) => {
      expect(await deliverChat(client, options)).toEqual({ sent: 1, failed: 0, retried: 0 });
      expect(await listChatMessages(client, { subject: 'J-1' })).toMatchObject([
        { status: 'sent', reason: '', attempts: 2 },
      ]);
    });
    expect(sent).toEqual(['22892000002']);

    fails = new ChatChannelError('recipient_unreachable');
    await as(YELLOW, async (client) => {
      const queued = await queue(client, 'J-2');
      expect(await deliverChat(client, options)).toEqual({ sent: 0, failed: 1, retried: 0 });
      expect(await listChatMessages(client, { subject: 'J-2' })).toMatchObject([
        { status: 'failed', reason: 'recipient_unreachable' },
      ]);
      fails = null;
      expect(await requeueChatMessage(client, queued.messageId ?? '')).toBe(true);
      expect(await deliverChat(client, options)).toMatchObject({ sent: 1 });
    });
  });

  it('fails, and says so, when the sender can no longer be opened', async () => {
    await as(YELLOW, async (client) => {
      await queueChatText(client, YELLOW, {
        reference: 'cus_afi',
        text: 'Bonjour',
        subject: 'J-3',
      });
      const another = { secretsKey: randomBytes(32).toString('base64'), connect };
      expect(await deliverChat(client, another)).toEqual({ sent: 0, failed: 1, retried: 0 });
      expect(await listChatMessages(client, { subject: 'J-3' })).toMatchObject([
        { status: 'failed', reason: 'not_connected' },
      ]);
    });
  });
});

describe('her consent and her link', () => {
  it('withdraws her consent when she says stop', async () => {
    const received = await receive(
      signedBy('secret-bleu', notification('1001', wrote('22890112233', 'wamid.A2', 'STOP'))),
    );
    expect(received.heard).toMatchObject([{ reference: 'cus_ama', intent: 'stop' }]);
    await as(BLEU, async (client) => {
      expect(await chatContactOf(client, 'cus_ama')).toMatchObject({ consent: false });
      const queued = await queueChatMessage(client, BLEU, {
        reference: 'cus_ama',
        kind: 'deposit.ready',
        values: { client: 'Ama', numero: 'A-0500' },
      });
      expect(queued).toMatchObject({ status: 'skipped', reason: 'no_consent' });
    });
  });

  it('reaches her on a bot only once she opened her link', async () => {
    let token = '';
    await as(BLEU, async (client) => {
      await connectChatSender(
        client,
        BLEU,
        { channel: 'telegram', botToken: '7001:jeton-bot', webhookSecret: 'secret-bot' },
        options,
      );
      await saveChatContact(client, BLEU, { reference: 'cus_efua', channel: 'telegram' });
      await setChatConsent(client, 'cus_efua', true);
      const early = await queueChatText(client, BLEU, { reference: 'cus_efua', text: 'Bonjour' });
      expect(early).toMatchObject({ status: 'skipped', reason: 'no_address' });
      token = (await chatLinkTokenOf(client, 'cus_efua')) ?? '';
      expect(await chatLinkTokenOf(client, 'cus_efua')).toBe(token);
    });
    const update = (secret: string) =>
      new Request('https://app.example/webhooks/telegram/7001', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': secret },
        body: JSON.stringify({
          update_id: 1,
          message: {
            message_id: 10,
            from: { id: 555, first_name: 'Efua' },
            chat: { id: 555, type: 'private' },
            text: `/start ${token}`,
          },
        }),
      });
    expect((await receive(update('another'), 'telegram', '7001')).response.status).toBe(401);
    expect((await receive(update('secret-bot'), 'telegram', '8008')).response.status).toBe(401);
    const received = await receive(update('secret-bot'), 'telegram', '7001');
    expect(received.heard).toMatchObject([
      { organizationId: BLEU, reference: 'cus_efua', intent: 'link' },
    ]);
    await as(BLEU, async (client) => {
      expect(await chatContactOf(client, 'cus_efua')).toMatchObject({ reachable: true });
      const queued = await queueChatText(client, BLEU, { reference: 'cus_efua', text: 'Bonjour' });
      expect(queued).toMatchObject({ status: 'queued' });
      expect(await deliverChat(client, options)).toMatchObject({ sent: 1 });
    });
    expect(sentFrom('7001')).toEqual([{ kind: 'text', to: '555', text: 'Bonjour', actions: [] }]);
  });

  it('ties a contact who hides her number by her link', async () => {
    let token = '';
    await as(VERT, async (client) => {
      await saveChatContact(client, VERT, { reference: 'cus_yao' });
      token = (await chatLinkTokenOf(client, 'cus_yao')) ?? '';
      expect(await chatContactOf(client, 'cus_yao')).toMatchObject({
        reachable: false,
        consent: false,
      });
    });
    const hidden = notification('2002', {
      contacts: [{ user_id: 'TG.yao4f9c2', profile: { name: 'Yao' } }],
      messages: [
        { from_user_id: 'TG.yao4f9c2', id: 'wamid.Y1', type: 'text', text: { body: token } },
      ],
    });
    const received = await receive(signedBy('secret-vert', hidden));
    expect(received.heard).toMatchObject([{ reference: 'cus_yao', intent: 'link' }]);
    await as(VERT, async (client) => {
      expect(await chatContactOf(client, 'cus_yao')).toMatchObject({
        reachable: true,
        consent: true,
      });
      await queueChatText(client, VERT, { reference: 'cus_yao', text: 'Bienvenue' });
      await deliverChat(client, options);
    });
    expect(sentFrom('2002').at(-1)).toMatchObject({ to: 'TG.yao4f9c2', text: 'Bienvenue' });
  });
});

describe('a message that waits for her quiet hours (spec 151)', () => {
  it('leaves only once the moment it was given has come', async () => {
    await as(BLEU, async (client) => {
      await saveChatContact(client, BLEU, { reference: 'cus_kafui', phone: '+228 90 44 55 66' });
      await setChatConsent(client, 'cus_kafui', true);
      const later = await queueChatText(client, BLEU, {
        reference: 'cus_kafui',
        text: 'Votre décision est attendue',
        subject: 'quiet',
        notBefore: new Date(Date.now() + 60 * 60_000),
      });
      expect(later).toMatchObject({ status: 'queued', reason: '' });
      expect(await deliverChat(client, options)).toEqual({ sent: 0, failed: 0, retried: 0 });
      await client.query(
        `update kete_chat_messages set next_attempt_at = now() - interval '1 minute'
          where message_id = $1`,
        [later.messageId],
      );
      expect(await deliverChat(client, options)).toMatchObject({ sent: 1 });
      expect(sentFrom('1001').at(-1)).toMatchObject({
        to: '22890445566',
        text: 'Votre décision est attendue',
      });
    });
  });
});
