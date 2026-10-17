import { createHash } from 'node:crypto';
import { inOrganization } from '@kete/tenancy';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { getHolding, workLinksMigrationSql, workMigrationSql } from '@kete/work';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeThread,
  editMessage,
  exportThread,
  leaveThread,
  markRead,
  messagesOf,
  openThread,
  postMessage,
  searchMessages,
  ThreadError,
  threadAt,
  threadOf,
  threadsMigrationSql,
  threadsOf,
  versionsOf,
} from '../src/index.js';

// Spec 113 (doctrine D-057): threads with a trace at least as good as mail. KYA: Phébé's computer
// has a problem; the IT holder holds the thread; Kossi is told for information.

let db: TestSchema;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(workMigrationSql({ schema, appRole }));
      await owner.query(workLinksMigrationSql({ schema }));
      await owner.query(threadsMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db.drop();
});

let organizations = 0;
const fresh = () => `org_threads_${++organizations}_${Date.now()}`;
const inOrg = <T>(organization: string, work: Parameters<typeof inOrganization<T>>[2]) =>
  inOrganization(db.app, organization, work);

const it_ = { kind: 'person', id: 'usr_it' } as const;
const phebe = { kind: 'person', id: 'usr_phebe' } as const;
const kossi = { kind: 'person', id: 'usr_kossi' } as const;
const computer = { kind: 'asset', id: 'ast_pc_phebe' };
const at = (minute: number) => new Date(Date.UTC(2026, 9, 16, 9, minute));

describe('a thread born with its object', () => {
  it('is one per object, with its holder a member from the start', async () => {
    const org = fresh();
    await inOrg(org, async (tx) => {
      const thread = await openThread(
        tx,
        org,
        {
          kind: 'object',
          object: computer,
          title: 'L’ordinateur de Phébé',
          holder: it_,
          address: 'Fil-PC-Phebe@kya.kete.software',
        },
        at(0),
      );
      expect(thread).toMatchObject({
        kind: 'object',
        object: computer,
        holder: it_,
        state: 'open',
        address: 'fil-pc-phebe@kya.kete.software',
        members: [{ kind: 'person', id: 'usr_it', role: 'member' }],
      });
      const again = await openThread(tx, org, {
        kind: 'object',
        object: computer,
        title: 'Autre',
        holder: phebe,
      });
      expect(again.id).toBe(thread.id);
      expect((await threadOf(tx, computer))?.id).toBe(thread.id);
      expect((await threadAt(tx, 'FIL-PC-PHEBE@kya.kete.software'))?.id).toBe(thread.id);
      await expect(
        openThread(tx, org, { kind: 'object', title: 'Sans objet', holder: it_ }),
      ).rejects.toMatchObject({ code: 'invalid_thread' });
    });
  });
});

describe('the trace, at least as good as mail', () => {
  it('makes a holding of a message for action, and none of one for information', async () => {
    const org = fresh();
    await inOrg(org, async (tx) => {
      const thread = await openThread(
        tx,
        org,
        { kind: 'object', object: computer, title: 'L’ordinateur de Phébé', holder: it_ },
        at(0),
      );
      const asked = await postMessage(
        tx,
        org,
        {
          thread: thread.id,
          author: phebe,
          text: 'Mon ordinateur ne démarre plus depuis ce matin.',
          for: 'action',
          via: 'whatsapp',
        },
        at(1),
      );
      expect(asked.holdingId).not.toBeNull();
      expect(await getHolding(tx, asked.holdingId as string)).toMatchObject({
        object: computer,
        holder: it_,
        what: 'Mon ordinateur ne démarre plus depuis ce matin.',
        state: 'held',
      });
      const told = await postMessage(
        tx,
        org,
        {
          thread: thread.id,
          author: it_,
          text: 'Kossi, pour info.',
          for: 'information',
          via: 'kete',
          mentions: [kossi],
        },
        at(2),
      );
      expect(told.holdingId).toBeNull();
      // Writing makes her a member, from then on.
      const members = (await threadOf(tx, computer))?.members ?? [];
      expect(members.map((m) => m.id)).toEqual(['usr_it', 'usr_phebe']);
    });
  });

  it('keeps the original of an edit, and the holding says the new words', async () => {
    const org = fresh();
    await inOrg(org, async (tx) => {
      const thread = await openThread(tx, org, {
        kind: 'group',
        title: 'Service informatique',
        holder: it_,
      });
      const { message, holdingId } = await postMessage(tx, org, {
        thread: thread.id,
        author: phebe,
        text: 'Écran noir',
        for: 'action',
        via: 'kete',
      });
      await expect(
        editMessage(tx, org, { messageId: message.id, by: kossi, text: 'Autre' }),
      ).rejects.toMatchObject({ code: 'not_the_author' });
      const edited = await editMessage(tx, org, {
        messageId: message.id,
        by: phebe,
        text: 'Écran noir, ventilateur bruyant',
      });
      expect(edited.edited_from).toBe(message.id);
      await expect(
        editMessage(tx, org, { messageId: message.id, by: phebe, text: 'Encore' }),
      ).rejects.toMatchObject({ code: 'already_edited' });
      expect((await versionsOf(tx, edited.id)).map((m) => m.text)).toEqual([
        'Écran noir',
        'Écran noir, ventilateur bruyant',
      ]);
      const shown = await messagesOf(tx, thread.id);
      expect(shown).toMatchObject([
        { first: message.id, id: edited.id, text: 'Écran noir, ventilateur bruyant', edits: 1 },
      ]);
      expect((await getHolding(tx, holdingId as string))?.what).toBe(
        'Écran noir, ventilateur bruyant',
      );
    });
  });

  it('says who read each message, and when — once', async () => {
    const org = fresh();
    await inOrg(org, async (tx) => {
      const thread = await openThread(tx, org, {
        kind: 'direct',
        title: 'Phébé',
        holder: it_,
        members: [phebe],
      });
      await postMessage(
        tx,
        org,
        { thread: thread.id, author: phebe, text: 'Bonjour', for: 'information', via: 'kete' },
        at(1),
      );
      expect(await markRead(tx, org, { threadId: thread.id, reader: it_ }, at(5))).toBe(1);
      expect(await markRead(tx, org, { threadId: thread.id, reader: it_ }, at(9))).toBe(0);
      // Her own message is not read by her.
      expect(await markRead(tx, org, { threadId: thread.id, reader: phebe }, at(6))).toBe(0);
      const [shown] = await messagesOf(tx, thread.id);
      expect(shown?.readBy).toEqual([{ kind: 'person', id: 'usr_it', at: at(5).toISOString() }]);
    });
  });

  it('keeps the dates of a member who left, and finds words in any thread', async () => {
    const org = fresh();
    await inOrg(org, async (tx) => {
      const thread = await openThread(
        tx,
        org,
        { kind: 'group', title: 'Comité', holder: it_, members: [kossi] },
        at(0),
      );
      await leaveThread(tx, thread.id, kossi, at(30));
      const kept = (await threadsOf(tx, it_)).find((t) => t.id === thread.id)?.members ?? [];
      expect(kept).toMatchObject([
        { id: 'usr_it' },
        { id: 'usr_kossi', since: at(0).toISOString(), until: at(30).toISOString() },
      ]);
      expect((await threadsOf(tx, kossi)).map((t) => t.id)).not.toContain(thread.id);
      await postMessage(tx, org, {
        thread: thread.id,
        author: it_,
        text: 'Le devis du kit solaire de Kpalimé',
        for: 'information',
        via: 'kete',
      });
      const found = await searchMessages(tx, { text: 'solaire Kpalimé' });
      expect(found.map((m) => m.text)).toEqual(['Le devis du kit solaire de Kpalimé']);
      expect(await searchMessages(tx, { text: 'facture' })).toEqual([]);
    });
  });

  it('says nothing more in a thread put away', async () => {
    const org = fresh();
    await inOrg(org, async (tx) => {
      const thread = await openThread(tx, org, {
        kind: 'object',
        object: computer,
        title: 'PC',
        holder: it_,
      });
      expect((await closeThread(tx, thread.id, at(40))).state).toBe('closed');
      await expect(
        postMessage(tx, org, {
          thread: thread.id,
          author: it_,
          text: 'Encore',
          for: 'information',
          via: 'kete',
        }),
      ).rejects.toBeInstanceOf(ThreadError);
    });
  });
});

describe('a thread exported as proof', () => {
  it('carries the journal, every version and every read, with its fingerprint', async () => {
    const org = fresh();
    await inOrg(org, async (tx) => {
      const thread = await openThread(
        tx,
        org,
        { kind: 'object', object: computer, title: 'L’ordinateur de Phébé', holder: it_ },
        at(0),
      );
      const { message } = await postMessage(
        tx,
        org,
        { thread: thread.id, author: phebe, text: 'Écran <noir>', for: 'action', via: 'mail' },
        at(1),
      );
      await editMessage(tx, org, { messageId: message.id, by: phebe, text: 'Écran noir' }, at(2));
      await markRead(tx, org, { threadId: thread.id, reader: it_ }, at(3));
      const proof = await exportThread(tx, thread.id, { now: at(10) });
      expect(proof.journal.messages.map((m) => m.text)).toEqual(['Écran <noir>', 'Écran noir']);
      expect(proof.journal.messages[0]?.readBy).toEqual([
        { kind: 'person', id: 'usr_it', at: at(3).toISOString() },
      ]);
      expect(proof.fingerprint).toBe(
        createHash('sha256').update(JSON.stringify(proof.journal)).digest('hex'),
      );
      expect(proof.html).toContain(proof.fingerprint);
      expect(proof.html).toContain('Écran &lt;noir&gt;');
      expect(proof.html).not.toContain('<noir>');
    });
  });
});

describe('isolation', () => {
  it('keeps each organization to its own threads and messages', async () => {
    for (const table of ['kete_threads', 'kete_messages']) {
      await assertOrganizationIsolation({
        app: db.app,
        table,
        organizations: [`org_iso_a_${table}`, `org_iso_b_${table}`],
        insert: async (client, organization) => {
          const thread = await openThread(client, organization, {
            kind: 'group',
            title: 'Iso',
            holder: it_,
          });
          await postMessage(client, organization, {
            thread: thread.id,
            author: it_,
            text: 'Iso',
            for: 'information',
            via: 'kete',
          });
        },
      });
    }
  });
});
