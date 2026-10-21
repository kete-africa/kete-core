import { inOrganization } from '@kete/tenancy';
import { createTestSchema, type TestSchema } from '@kete/testing';
import {
  finishHolding,
  getHolding,
  workLinksMigrationSql,
  workMigrationSql,
  workPrioritiesMigrationSql,
} from '@kete/work';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  changesSince,
  filesOf,
  joinThread,
  leaveThread,
  listenThreads,
  markRead,
  markUnread,
  messagesOf,
  moveMessage,
  openThread,
  postMessage,
  saveThreadFile,
  threadChangeOf,
  ThreadError,
  threadFile,
  threadsLiveMigrationSql,
  threadsMigrationSql,
  threadSummariesOf,
  type ThreadChange,
} from '../src/index.js';

// Spec 139: threads people live in. KYA: the Garage Bè site — Abla holds it, Folly works on it,
// Kossi is added later; a supplier's quote is attached twice; a word said in the wrong thread moves.

let db: TestSchema;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(workMigrationSql({ schema, appRole }));
      await owner.query(workLinksMigrationSql({ schema }));
      await owner.query(workPrioritiesMigrationSql({ schema }));
      await owner.query(threadsMigrationSql({ schema, appRole }));
      await owner.query(threadsLiveMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db.drop();
});

let organizations = 0;
const fresh = () => `org_live_${++organizations}_${Date.now()}`;
const inOrg = <T>(organization: string, work: Parameters<typeof inOrganization<T>>[2]) =>
  inOrganization(db.app, organization, work);

const abla = { kind: 'person', id: 'usr_abla' } as const;
const folly = { kind: 'person', id: 'usr_folly' } as const;
const kossi = { kind: 'person', id: 'usr_kossi' } as const;
const at = (minute: number) => new Date(Date.UTC(2026, 9, 21, 9, minute));

async function site(org: string) {
  return inOrg(org, (tx) =>
    openThread(
      tx,
      org,
      {
        kind: 'object',
        object: { kind: 'project', id: 'prj_garage_be' },
        title: 'Chantier Garage Bè',
        holder: abla,
        members: [folly],
      },
      at(0),
    ),
  );
}

describe('what is unread', () => {
  it('counts what she did not write nor read, reads up to her own words, and marks unread', async () => {
    const org = fresh();
    const thread = await site(org);
    await inOrg(org, async (tx) => {
      await postMessage(
        tx,
        org,
        {
          thread: thread.id,
          author: folly,
          text: 'Les batteries arrivent jeudi.',
          for: 'information',
          via: 'kete',
        },
        at(1),
      );
      await postMessage(
        tx,
        org,
        {
          thread: thread.id,
          author: folly,
          text: 'Le client veut une visite.',
          for: 'information',
          via: 'kete',
        },
        at(2),
      );
      let [summary] = await threadSummariesOf(tx, abla);
      expect(summary).toMatchObject({ unread: 2, last: { text: 'Le client veut une visite.' } });
      // Folly wrote them: nothing unread for him.
      expect((await threadSummariesOf(tx, folly))[0]?.unread).toBe(0);
      // Abla answers: writing reads what came before.
      await postMessage(
        tx,
        org,
        {
          thread: thread.id,
          author: abla,
          text: 'Je passe vendredi.',
          for: 'information',
          via: 'kete',
        },
        at(3),
      );
      [summary] = await threadSummariesOf(tx, abla);
      expect(summary?.unread).toBe(0);
      // She marks it unread from Folly's second message.
      const messages = await messagesOf(tx, thread.id);
      await markUnread(tx, org, { messageId: messages[1]?.id ?? '', reader: abla });
      expect((await threadSummariesOf(tx, abla))[0]?.unread).toBe(1);
      // « Read by » keeps when she read it: the mark is hers, not the trace.
      expect((await messagesOf(tx, thread.id))[1]?.readBy).toEqual([
        { kind: 'person', id: 'usr_abla', at: at(3).toISOString() },
      ]);
      await markRead(tx, org, { threadId: thread.id, reader: abla }, at(4));
      expect((await threadSummariesOf(tx, abla))[0]?.unread).toBe(0);
    });
  });

  it('lists by last activity and counts the actions still open', async () => {
    const org = fresh();
    const thread = await site(org);
    await inOrg(org, async (tx) => {
      const group = await openThread(tx, org, { kind: 'group', title: 'SAV', holder: abla }, at(5));
      const asked = await postMessage(
        tx,
        org,
        {
          thread: thread.id,
          author: abla,
          text: 'Commander deux batteries.',
          for: 'action',
          to: folly,
          via: 'kete',
        },
        at(6),
      );
      const urgent = await postMessage(
        tx,
        org,
        {
          thread: thread.id,
          author: abla,
          text: 'Rappeler le client avant vendredi.',
          for: 'action',
          via: 'kete',
        },
        at(6),
        { due: '2026-10-24', priority: 'urgent' },
      );
      expect(await getHolding(tx, urgent.holdingId ?? '')).toMatchObject({
        due: '2026-10-24',
        priority: 'urgent',
        holder: abla,
      });
      await finishHolding(tx, org, urgent.holdingId ?? '', at(6));
      let summaries = await threadSummariesOf(tx, abla);
      expect(summaries.map((s) => s.thread.id)).toEqual([thread.id, group.id]);
      expect(summaries[0]?.openActions).toBe(1);
      await finishHolding(tx, org, asked.holdingId ?? '', at(7));
      summaries = await threadSummariesOf(tx, abla);
      expect(summaries[0]?.openActions).toBe(0);
    });
  });
});

describe('members and mentions', () => {
  it('adds and removes members; a mentioned person joins', async () => {
    const org = fresh();
    const thread = await site(org);
    await inOrg(org, async (tx) => {
      await postMessage(
        tx,
        org,
        {
          thread: thread.id,
          author: abla,
          text: '@Kossi peux-tu valider le devis ?',
          for: 'information',
          mentions: [kossi],
          via: 'kete',
        },
        at(8),
      );
      expect((await threadSummariesOf(tx, kossi)).map((s) => s.thread.id)).toEqual([thread.id]);
      await leaveThread(tx, thread.id, kossi, at(9));
      expect(await threadSummariesOf(tx, kossi)).toEqual([]);
      await joinThread(tx, org, thread.id, { ...kossi, role: 'subscriber' }, at(10));
      expect((await threadSummariesOf(tx, kossi))[0]?.thread.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'usr_kossi', until: at(9).toISOString() }),
          expect.objectContaining({ id: 'usr_kossi', role: 'subscriber' }),
        ]),
      );
    });
  });
});

describe('files', () => {
  it('keeps a file and its next version under the same name', async () => {
    const org = fresh();
    const thread = await site(org);
    await inOrg(org, async (tx) => {
      const first = await saveThreadFile(
        tx,
        org,
        {
          threadId: thread.id,
          name: 'Devis batteries.pdf',
          mediaType: 'application/pdf',
          content: new TextEncoder().encode('%PDF v1'),
          by: folly,
        },
        at(11),
      );
      const second = await saveThreadFile(
        tx,
        org,
        {
          threadId: thread.id,
          name: 'devis batteries.pdf',
          mediaType: 'application/pdf',
          content: new TextEncoder().encode('%PDF v2'),
          by: folly,
        },
        at(12),
      );
      expect(first.version).toBe(1);
      expect(second.version).toBe(2);
      expect((await filesOf(tx, thread.id)).map((f) => f.id)).toEqual([second.id, first.id]);
      const read = await threadFile(tx, first.id);
      expect(new TextDecoder().decode(read?.content)).toBe('%PDF v1');
      expect(read?.sha256).toHaveLength(64);
      await expect(
        saveThreadFile(tx, org, {
          threadId: thread.id,
          name: 'vide.txt',
          mediaType: 'text/plain',
          content: new Uint8Array(),
          by: folly,
        }),
      ).rejects.toThrow(ThreadError);
    });
  });
});

describe('a message moved', () => {
  it('goes to the right thread and stays where it was said, saying where it went', async () => {
    const org = fresh();
    const thread = await site(org);
    await inOrg(org, async (tx) => {
      const group = await openThread(
        tx,
        org,
        { kind: 'group', title: 'Achats', holder: abla, members: [folly] },
        at(13),
      );
      const said = await postMessage(
        tx,
        org,
        {
          thread: group.id,
          author: folly,
          text: 'Le garage paie en deux fois.',
          for: 'information',
          via: 'kete',
        },
        at(14),
      );
      // Kossi neither wrote it nor holds the thread.
      await expect(
        moveMessage(tx, org, { messageId: said.message.id, to: thread.id, by: kossi }),
      ).rejects.toThrow(ThreadError);
      const moved = await moveMessage(
        tx,
        org,
        { messageId: said.message.id, to: thread.id, by: folly },
        at(15),
      );
      expect(moved).toMatchObject({ thread: thread.id, moved_from: said.message.id });
      expect((await messagesOf(tx, group.id))[0]?.movedTo).toEqual({
        thread: thread.id,
        message: moved.id,
        at: at(15).toISOString(),
      });
      await expect(
        moveMessage(tx, org, { messageId: said.message.id, to: thread.id, by: folly }),
      ).rejects.toThrow('moved already');
    });
  });
});

describe('internal or outside', () => {
  it('is internal unless said for the outside; a contact speaks outside', async () => {
    const org = fresh();
    const thread = await site(org);
    await inOrg(org, async (tx) => {
      const note = await postMessage(
        tx,
        org,
        { thread: thread.id, author: abla, text: 'Note interne.', for: 'information', via: 'kete' },
        at(16),
      );
      const answer = await postMessage(
        tx,
        org,
        {
          thread: thread.id,
          author: abla,
          text: 'Bonjour, nous passons vendredi.',
          for: 'information',
          visibility: 'outside',
          via: 'kete',
        },
        at(17),
      );
      const client = await postMessage(
        tx,
        org,
        {
          thread: thread.id,
          author: { kind: 'contact', id: 'whatsapp:+22890000000' },
          text: 'Merci !',
          for: 'information',
          via: 'whatsapp',
        },
        at(18),
      );
      expect([note, answer, client].map((p) => p.message.visibility)).toEqual([
        'internal',
        'outside',
        'outside',
      ]);
    });
  });
});

describe('live', () => {
  it('announces a change once it commits, never before, and says what changed since', async () => {
    const org = fresh();
    // Opened a minute ago, in real time: what changed is compared with the clock.
    const thread = await inOrg(org, (tx) =>
      openThread(
        tx,
        org,
        { kind: 'group', title: 'Équipe terrain', holder: abla, members: [folly] },
        new Date(Date.now() - 60_000),
      ),
    );
    const client = await db.app.connect();
    const heard: ThreadChange[] = [];
    const stop = await listenThreads(client, (change) => {
      if (change.organizationId === org) heard.push(change);
    });
    try {
      const before = new Date();
      await inOrg(org, async (tx) => {
        await postMessage(tx, org, {
          thread: thread.id,
          author: folly,
          text: 'Arrivé sur place.',
          for: 'information',
          via: 'kete',
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
        // Not committed yet: nothing is heard.
        expect(heard).toEqual([]);
      });
      for (let i = 0; i < 40 && heard.length === 0; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(heard).toContainEqual({ organizationId: org, threadId: thread.id, kind: 'message' });
      expect(await inOrg(org, (tx) => changesSince(tx, abla, before))).toEqual([thread.id]);
      const after = new Date();
      expect(await inOrg(org, (tx) => changesSince(tx, abla, after))).toEqual([]);
    } finally {
      await stop();
      client.release();
    }
    expect(threadChangeOf('{"o":"org","t":"thr","k":"nope"}')).toBeNull();
  });
});
