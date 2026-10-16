import type { ChatInbound } from '@kete/notify';
import { inOrganization, type SqlExecutor } from '@kete/tenancy';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { messagesOf, openThread, threadOf, threadsMigrationSql } from '@kete/threads';
import { getHolding, workMigrationSql } from '@kete/work';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addRoutingRule,
  answerByMail,
  channelsMigrationSql,
  fromChat,
  fromForm,
  fromMail,
  memoryMailbox,
  memorySender,
  readMailbox,
  route,
  settle,
  type RouterOptions,
} from '../src/index.js';

// Spec 113 (doctrine D-056): what the outside says lands in its object's thread with a holder —
// by a rule, by the model above a threshold, or by a person on a card « à classer ».

let db: TestSchema;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(workMigrationSql({ schema, appRole }));
      await owner.query(threadsMigrationSql({ schema, appRole }));
      await owner.query(channelsMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db.drop();
});

let organizations = 0;
const fresh = () => `org_channels_${++organizations}_${Date.now()}`;
const inOrg = <T>(organization: string, work: (tx: SqlExecutor) => Promise<T>) =>
  inOrganization(db.app, organization, work);

const abla = { kind: 'person', id: 'usr_abla' } as const;
const engineer = { kind: 'person', id: 'usr_ingenieur' } as const;
const colombe = { kind: 'project', id: 'prj_colombe' };
const options: RouterOptions = {
  triage: abla,
  threadFor: async (object) => ({ title: `Projet ${object.id}`, holder: engineer }),
};

const whatsapp = (id: string, phone: string, text: string): ChatInbound => ({
  channel: 'whatsapp',
  providerMessageId: id,
  sender: { id: phone, phone, address: phone, username: null, displayName: 'Garage Bè' },
  kind: 'text',
  text,
});

const mail = (input: { id: string; from: string; to: string; subject: string; text: string }) =>
  [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    `Message-ID: <${input.id}>`,
    'Date: Fri, 16 Oct 2026 09:00:00 +0000',
    'Content-Type: text/plain; charset=utf-8',
    '',
    input.text,
  ].join('\r\n');

describe('a client’s WhatsApp message', () => {
  it('lands in its project’s thread with a holder, by the rule that knows her number — once', async () => {
    const org = fresh();
    await inOrg(org, async (tx) => {
      await addRoutingRule(tx, org, {
        match: 'whatsapp:22890000001',
        object: colombe,
        intent: 'client_message',
        by: 'usr_abla',
      });
      const received = fromChat(whatsapp('wamid.1', '22890000001', 'Les panneaux sont livrés ?'));
      const routing = await route(tx, org, received, options);
      expect(routing).toMatchObject({ object: colombe, intent: 'client_message', by: 'rule' });
      const thread = await threadOf(tx, colombe);
      expect(thread).toMatchObject({ id: routing.thread, holder: engineer });
      expect(await getHolding(tx, routing.holding as string)).toMatchObject({
        holder: engineer,
        what: 'Les panneaux sont livrés ?',
      });
      const shown = await messagesOf(tx, thread?.id ?? '');
      expect(shown).toMatchObject([
        { author: { kind: 'contact', id: 'whatsapp:22890000001' }, via: 'whatsapp', for: 'action' },
      ]);
      // The provider delivers it again: routed once.
      expect(await route(tx, org, received, options)).toEqual(routing);
      expect(await messagesOf(tx, thread?.id ?? '')).toHaveLength(1);
    });
  });
});

describe('a client the product knows', () => {
  it('lands in her open project’s thread, by her number', async () => {
    const org = fresh();
    await inOrg(org, async (tx) => {
      const routing = await route(
        tx,
        org,
        fromChat(whatsapp('wamid.k1', '22890000009', 'Bonjour, où en est mon installation ?')),
        {
          ...options,
          known: async (received) =>
            received.from.phone === '22890000009'
              ? { object: colombe, intent: 'client_message' }
              : null,
        },
      );
      expect(routing).toMatchObject({ object: colombe, by: 'rule', intent: 'client_message' });
      expect((await threadOf(tx, colombe))?.holder).toEqual(engineer);
    });
  });
});

describe('an unknown mail', () => {
  it('raises a card « à classer »; settled, it lands and its sender is known from then on', async () => {
    const org = fresh();
    await inOrg(org, async (tx) => {
      const first = await fromMail(
        mail({
          id: 'm1@hotel.tg',
          from: 'Hôtel du Golfe <direction@hotel-golfe.tg>',
          to: 'abla@kya.tg',
          subject: 'Climatisation en panne',
          text: 'La clim de la salle B ne refroidit plus.',
        }),
      );
      const asked = await route(tx, org, first, options);
      expect(asked).toMatchObject({ intent: 'unknown', confidence: 0, by: 'model' });
      expect(asked.thread).toBeUndefined();
      expect(await getHolding(tx, asked.asked as string)).toMatchObject({
        holder: abla,
        what: 'À classer : Climatisation en panne',
      });
      const settled = await settle(
        tx,
        org,
        { via: 'mail', ref: first.ref, object: colombe, intent: 'incident', by: abla },
        options,
      );
      expect(settled).toMatchObject({ object: colombe, by: 'person', intent: 'incident' });
      expect((await getHolding(tx, asked.asked as string))?.state).toBe('done');
      const [said] = await messagesOf(tx, settled.thread as string);
      expect(said?.text).toBe('Climatisation en panne\n\nLa clim de la salle B ne refroidit plus.');
      const second = await fromMail(
        mail({
          id: 'm2@hotel.tg',
          from: 'direction@hotel-golfe.tg',
          to: 'abla@kya.tg',
          subject: 'Toujours en panne',
          text: 'Rien de neuf.',
        }),
      );
      expect(await route(tx, org, second, options)).toMatchObject({
        object: colombe,
        by: 'rule',
        intent: 'incident',
      });
    });
  });

  it('is not guessed under the threshold, and is placed by the model above it', async () => {
    const org = fresh();
    await inOrg(org, async (tx) => {
      const unsure: RouterOptions = {
        ...options,
        read: async () => ({ intent: 'incident', object: colombe, confidence: 0.55 }),
      };
      const text = { from: 'x@y.tg', to: 'abla@kya.tg', subject: 'Panne', text: '…' };
      const asked = await route(tx, org, await fromMail(mail({ id: 'u1@y', ...text })), unsure);
      expect(asked).toMatchObject({ intent: 'incident', confidence: 0.55, by: 'model' });
      expect(asked.asked).toBeDefined();
      const sure: RouterOptions = {
        ...options,
        read: async () => ({ intent: 'incident', object: colombe, confidence: 0.93 }),
      };
      const placed = await route(tx, org, await fromMail(mail({ id: 'u2@y', ...text })), sure);
      expect(placed).toMatchObject({ object: colombe, confidence: 0.93, by: 'model' });
      expect(placed.asked).toBeUndefined();
    });
  });
});

describe('the mail bridged into a thread', () => {
  it('sends an answer from her box with the thread’s address, and its reply comes back into it', async () => {
    const org = fresh();
    await inOrg(org, async (tx) => {
      await openThread(tx, org, {
        kind: 'object',
        object: colombe,
        title: 'Projet Colombe',
        holder: engineer,
        address: 'fil-colombe@kya.kete.software',
      });
      const inbox = memoryMailbox([
        mail({
          id: 'c1@client.tg',
          from: 'Client <client@colombe.tg>',
          to: 'ingenieur@kya.tg',
          subject: 'Planning',
          text: 'Quand venez-vous ?',
        }),
      ]);
      await addRoutingRule(tx, org, {
        match: 'domain:colombe.tg',
        object: colombe,
        intent: 'client_message',
        by: 'usr_abla',
      });
      const [first] = await readMailbox(tx, org, { key: 'usr_ingenieur', mailbox: inbox }, options);
      expect(first).toMatchObject({ object: colombe, by: 'rule' });
      // Nothing new: nothing routed again.
      expect(await readMailbox(tx, org, { key: 'usr_ingenieur', mailbox: inbox }, options)).toEqual(
        [],
      );
      const sender = memorySender();
      const answer = await answerByMail(tx, {
        message: { thread: first?.thread as string, text: 'Mardi à 9 h.' },
        from: { name: 'Ingénieur KYA', address: 'ingenieur@kya.tg' },
        sender,
        mailbox: inbox,
      });
      expect(answer.to).toEqual(['client@colombe.tg']);
      expect(sender.sent[0]).toMatchObject({
        subject: 'Projet Colombe',
        replyTo: 'fil-colombe@kya.kete.software',
        inReplyTo: '<c1@client.tg>',
      });
      expect(inbox.sent).toHaveLength(1);
      // Her answer by mail, to the thread's address, from someone no rule knows.
      inbox.deliver(
        mail({
          id: 'c2@ailleurs.tg',
          from: 'Associé <associe@ailleurs.tg>',
          to: 'fil-colombe@kya.kete.software',
          subject: 'Re: Projet Colombe',
          text: 'Mardi nous convient.',
        }),
      );
      const [reply] = await readMailbox(tx, org, { key: 'usr_ingenieur', mailbox: inbox }, options);
      expect(reply).toMatchObject({ thread: first?.thread, intent: 'reply', by: 'rule' });
      expect((await messagesOf(tx, first?.thread as string)).map((m) => m.author.id)).toEqual([
        'mail:client@colombe.tg',
        'mail:associe@ailleurs.tg',
      ]);
    });
  });
});

describe('KYA: a quote request for a solar system through a form', () => {
  it('makes a new project with its engineer, and a holding « dimension and price »', async () => {
    const org = fresh();
    await inOrg(org, async (tx) => {
      const made: string[] = [];
      const routing = await route(
        tx,
        org,
        fromForm({
          ref: 'sub_001',
          form: 'Demande de devis solaire',
          name: 'Ama Koffi',
          email: 'ama@exemple.tg',
          text: 'Maison à Kpalimé, 3 chambres, coupures fréquentes.',
        }),
        {
          ...options,
          read: async () => ({ intent: 'quote_request', confidence: 0.9 }),
          objectFor: async (_received, reading) => {
            made.push(reading.intent);
            return { kind: 'project', id: 'prj_kpalime_ama' };
          },
        },
      );
      expect(made).toEqual(['quote_request']);
      expect(routing).toMatchObject({
        object: { kind: 'project', id: 'prj_kpalime_ama' },
        intent: 'quote_request',
        by: 'model',
      });
      expect(await getHolding(tx, routing.holding as string)).toMatchObject({
        holder: engineer,
        object: { kind: 'project', id: 'prj_kpalime_ama' },
      });
    });
  });
});

describe('isolation', () => {
  it('keeps each organization to its own rules and routings', async () => {
    for (const table of ['kete_routing_rules', 'kete_routings']) {
      await assertOrganizationIsolation({
        app: db.app,
        table,
        organizations: [`org_iso_a_${table}`, `org_iso_b_${table}`],
        insert: async (client, organization) => {
          await addRoutingRule(client, organization, {
            match: `whatsapp:${organization}`,
            object: colombe,
            intent: 'client_message',
            by: 'usr_abla',
          });
          await route(
            client,
            organization,
            fromChat(whatsapp(`wamid.${organization}`, organization, 'Bonjour')),
            options,
          );
        },
      });
    }
  });
});
