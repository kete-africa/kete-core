import { inOrganization } from '@kete/tenancy';
import { createTestSchema, type TestSchema } from '@kete/testing';
import {
  workDelegatesMigrationSql,
  workLinksMigrationSql,
  workMigrationSql,
  workPrioritiesMigrationSql,
} from '@kete/work';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { insert } from '../src/messages.js';
import {
  attachThread,
  citedIn,
  deleteMessage,
  exportThread,
  importMessages,
  linksOf,
  markRead,
  mediaOf,
  mergeThreads,
  messagesOf,
  messagesPage,
  notifyLevelOf,
  openThread,
  parseTelegramExport,
  parseWhatsAppExport,
  pinMessage,
  pinsOf,
  postMessage,
  react,
  saveThreadFile,
  searchMessages,
  setNotifyLevel,
  setTranscript,
  shareMessage,
  threadChangeOf,
  ThreadError,
  threadFile,
  threadFileInfo,
  threadsComfortMigrationSql,
  threadsLiveMigrationSql,
  threadsMigrationSql,
  threadsOfObject,
  threadSummariesOf,
  unpinMessage,
  unreact,
  whoToTell,
  type ThreadFileStore,
} from '../src/index.js';

// Spec 140: threads for everyone. KYA's site La Colombe — Afi holds it, Kossi and Yao work on it,
// Kete answers in it; a WhatsApp group's export comes in; two threads become one.

let db: TestSchema;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(workMigrationSql({ schema, appRole }));
      await owner.query(workLinksMigrationSql({ schema }));
      await owner.query(workPrioritiesMigrationSql({ schema }));
      await owner.query(workDelegatesMigrationSql({ schema }));
      await owner.query(threadsMigrationSql({ schema, appRole }));
      await owner.query(threadsLiveMigrationSql({ schema, appRole }));
      await owner.query(threadsComfortMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db.drop();
});

let organizations = 0;
const fresh = () => `org_comfort_${++organizations}_${Date.now()}`;
const inOrg = <T>(organization: string, work: Parameters<typeof inOrganization<T>>[2]) =>
  inOrganization(db.app, organization, work);

const afi = { kind: 'person', id: 'usr_afi' } as const;
const kossi = { kind: 'person', id: 'usr_kossi' } as const;
const yao = { kind: 'person', id: 'usr_yao' } as const;
const kete = { kind: 'agent', id: 'agt_kete' } as const;
const at = (minute: number) => new Date(Date.UTC(2026, 9, 21, 9, minute));

async function colombe(org: string) {
  return inOrg(org, (tx) =>
    openThread(
      tx,
      org,
      {
        kind: 'object',
        object: { kind: 'project', id: 'prj_colombe' },
        title: 'Éclairage — La Colombe',
        holder: afi,
        members: [kossi, yao],
      },
      at(0),
    ),
  );
}

const say = (thread: string, author: { kind: 'person' | 'agent'; id: string }, text: string) => ({
  thread,
  author,
  text,
  for: 'information' as const,
  via: 'kete' as const,
});

describe('reactions, pins, a message taken back (FR-001 to FR-003)', () => {
  it('reacts and takes it back, pins and unpins, and hides a deleted message but not from the proof', async () => {
    const org = fresh();
    const thread = await colombe(org);
    await inOrg(org, async (tx) => {
      const { message } = await postMessage(
        tx,
        org,
        say(thread.id, kossi, 'Bon de commande reçu'),
        at(1),
      );
      await react(tx, org, { messageId: message.id, by: afi, emoji: '👍' }, at(2));
      await react(tx, org, { messageId: message.id, by: yao, emoji: '👍' }, at(2));
      await react(tx, org, { messageId: message.id, by: yao, emoji: '👍' }, at(3));
      await react(tx, org, { messageId: message.id, by: yao, emoji: '✅' }, at(3));
      await unreact(tx, { messageId: message.id, by: yao, emoji: '✅' });
      let [shown] = await messagesOf(tx, thread.id);
      expect(shown?.reactions).toEqual([{ emoji: '👍', by: [afi, yao] }]);

      await pinMessage(tx, org, { messageId: message.id, by: afi }, at(4));
      await pinMessage(tx, org, { messageId: message.id, by: yao }, at(5));
      expect(await pinsOf(tx, thread.id)).toEqual([
        { message: message.id, by: afi, at: at(4).toISOString() },
      ]);
      await unpinMessage(tx, { messageId: message.id, by: yao }, at(6));
      expect(await pinsOf(tx, thread.id)).toEqual([]);

      await expect(
        deleteMessage(tx, org, { messageId: message.id, by: afi }),
      ).rejects.toMatchObject({ code: 'not_the_author' });
      await deleteMessage(tx, org, { messageId: message.id, by: kossi }, at(7));
      [shown] = await messagesOf(tx, thread.id);
      expect(shown).toMatchObject({ text: '', deleted: { by: kossi } });
      expect(await searchMessages(tx, { text: 'commande' })).toEqual([]);
      const [summary] = await threadSummariesOf(tx, yao);
      expect(summary?.last?.text).toBe('');
      const proof = await exportThread(tx, thread.id);
      expect(JSON.stringify(proof)).toContain('Bon de commande reçu');
    });
  });
});

describe('voice notes and files (FR-004, FR-009)', () => {
  it('keeps a voice note in the storage, transcribes it once, and finds it by its words', async () => {
    const org = fresh();
    const thread = await colombe(org);
    const kept = new Map<string, Uint8Array>();
    const store: ThreadFileStore = {
      put: async (key, body) => void kept.set(key, body),
      get: async (key) => kept.get(key) ?? null,
    };
    await inOrg(org, async (tx) => {
      const audio = new Uint8Array(11 * 1024 * 1024).fill(7);
      await expect(
        saveThreadFile(tx, org, {
          threadId: thread.id,
          name: 'vocal.ogg',
          mediaType: 'audio/ogg',
          content: audio,
          by: yao,
        }),
      ).rejects.toMatchObject({ code: 'file_too_large' });
      const file = await saveThreadFile(
        tx,
        org,
        { threadId: thread.id, name: 'vocal.ogg', mediaType: 'audio/ogg', content: audio, by: yao },
        at(1),
        { store },
      );
      expect(kept.size).toBe(1);
      expect((await threadFile(tx, file.id, { store }))?.content.byteLength).toBe(audio.byteLength);
      // Without its store, a kept file has no bytes here, but its description stays.
      expect(await threadFile(tx, file.id)).toBeNull();
      expect(await threadFileInfo(tx, file.id)).toMatchObject({ id: file.id, name: 'vocal.ogg' });
      const { message } = await postMessage(
        tx,
        org,
        {
          ...say(thread.id, yao, ''),
          attachments: [
            { id: file.id, name: 'vocal.ogg', media_type: 'audio/ogg', duration_ms: 42000 },
          ],
        },
        at(2),
      );
      await setTranscript(tx, org, {
        messageId: message.id,
        fileId: file.id,
        text: 'je réceptionne le matériel à dix heures',
      });
      await setTranscript(tx, org, { messageId: message.id, fileId: file.id, text: 'autre chose' });
      const [shown] = await messagesOf(tx, thread.id);
      expect(shown?.attachments?.[0]).toMatchObject({
        duration_ms: 42000,
        transcript: 'je réceptionne le matériel à dix heures',
      });
      expect((await searchMessages(tx, { text: 'réceptionne' })).map((m) => m.id)).toEqual([
        message.id,
      ]);
      const media = await mediaOf(tx, thread.id);
      expect(media.voices).toMatchObject([{ file: file.id, durationMs: 42000 }]);
    });
  });
});

describe('citations (FR-005)', () => {
  it('says where an object was cited, and finds a thread from every object it is attached to', async () => {
    const org = fresh();
    const thread = await colombe(org);
    await inOrg(org, async (tx) => {
      const devis = { kind: 'quote', id: 'D-2026-0031', app: 'finance' };
      const { message } = await postMessage(
        tx,
        org,
        { ...say(thread.id, kossi, 'Nouveau tarif pour #D-2026-0031'), references: [devis] },
        at(3),
      );
      expect(await citedIn(tx, { kind: 'quote', id: 'D-2026-0031' })).toEqual([
        { thread: thread.id, message: message.id, author: kossi, at: at(3).toISOString() },
      ]);
      const committee = await openThread(
        tx,
        org,
        { kind: 'group', title: 'Comité', holder: afi },
        at(4),
      );
      await attachThread(tx, org, {
        threadId: committee.id,
        object: { kind: 'project', id: 'prj_colombe' },
        by: afi,
      });
      expect(await threadsOfObject(tx, { kind: 'project', id: 'prj_colombe' })).toEqual([
        thread.id,
        committee.id,
      ]);
      expect(await linksOf(tx, committee.id)).toEqual([{ kind: 'project', id: 'prj_colombe' }]);
    });
  });
});

describe('pages (FR-006)', () => {
  it('gives a page at a time, the latest first, and the page around a message found', async () => {
    const org = fresh();
    const thread = await colombe(org);
    await inOrg(org, async (tx) => {
      // Written straight, one query each: the pages are what is proven, within CI's time.
      const ids: string[] = [];
      for (let i = 0; i < 30; i += 1) {
        const id = `msg_page${String(i).padStart(2, '0')}xxxxxxxx`;
        await insert(tx, org, {
          ...say(thread.id, i % 2 ? kossi : yao, `message ${i}`),
          id,
          visibility: 'internal',
          at: new Date(at(0).getTime() + i * 1000).toISOString(),
        });
        ids.push(id);
      }
      // Fifty by default: the whole thread fits.
      expect((await messagesPage(tx, thread.id)).messages).toHaveLength(30);
      const last = await messagesPage(tx, thread.id, { limit: 10 });
      expect(last.messages).toHaveLength(10);
      expect(last.messages.at(-1)?.text).toBe('message 29');
      expect(last.older).toBe(true);
      const before = await messagesPage(tx, thread.id, {
        before: last.messages[0]?.id as string,
        limit: 10,
      });
      expect(before.messages.at(-1)?.text).toBe('message 19');
      const around = await messagesPage(tx, thread.id, { around: ids[10] as string, limit: 10 });
      expect(around.messages.map((m) => m.text)).toEqual(
        [6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((n) => `message ${n}`),
      );
      expect(around).toMatchObject({ older: true, newer: true });
    });
  });
});

describe('only for one, and telling (FR-010, FR-011)', () => {
  it('shows Kete’s private answer to her alone until she shares it', async () => {
    const org = fresh();
    const thread = await colombe(org);
    await inOrg(org, async (tx) => {
      const { message } = await postMessage(
        tx,
        org,
        { ...say(thread.id, kete, 'La marge passe à 195 000 F.'), only_for: afi },
        at(5),
      );
      expect(await messagesOf(tx, thread.id, { viewer: yao })).toEqual([]);
      expect(await messagesOf(tx, thread.id, { viewer: afi })).toHaveLength(1);
      expect(await searchMessages(tx, { text: 'marge', viewer: yao })).toEqual([]);
      expect(await whoToTell(tx, message.id)).toEqual([
        { kind: 'person', id: 'usr_afi', because: 'message' },
      ]);
      await expect(
        shareMessage(tx, org, { messageId: message.id, by: yao }),
      ).rejects.toBeInstanceOf(ThreadError);
      const shared = await shareMessage(tx, org, { messageId: message.id, by: afi }, at(6));
      expect(await shareMessage(tx, org, { messageId: message.id, by: afi })).toMatchObject({
        id: shared.id,
      });
      const seen = await messagesOf(tx, thread.id, { viewer: yao });
      expect(seen.map((m) => m.text)).toEqual(['La marge passe à 195 000 F.']);
      expect((await messagesOf(tx, thread.id, { viewer: afi }))[0]?.sharedAs).toBe(shared.id);
    });
  });

  it('tells each member as her level wants, always whoever must act, never who read it', async () => {
    const org = fresh();
    const thread = await colombe(org);
    await inOrg(org, async (tx) => {
      await setNotifyLevel(tx, org, { threadId: thread.id, member: yao, level: 'mentions' });
      await setNotifyLevel(tx, org, { threadId: thread.id, member: kossi, level: 'none' });
      expect(await notifyLevelOf(tx, thread.id, yao)).toBe('mentions');
      const plain = await postMessage(tx, org, say(thread.id, afi, 'Point demain'), at(7));
      expect(await whoToTell(tx, plain.message.id)).toEqual([]);
      const mention = await postMessage(
        tx,
        org,
        { ...say(thread.id, afi, '@Yao @Kossi les câbles ?'), mentions: [yao, kossi] },
        at(8),
      );
      expect(await whoToTell(tx, mention.message.id)).toEqual([
        { kind: 'person', id: 'usr_yao', because: 'mention' },
      ]);
      const action = await postMessage(
        tx,
        org,
        { ...say(thread.id, afi, 'Commander les câbles'), for: 'action', to: kossi },
        at(9),
      );
      expect(await whoToTell(tx, action.message.id)).toEqual([
        { kind: 'person', id: 'usr_kossi', because: 'action' },
      ]);
      await markRead(tx, org, { threadId: thread.id, reader: kossi }, at(10));
      expect(await whoToTell(tx, action.message.id)).toEqual([]);
    });
  });

  it('reads who is typing from an announcement', () => {
    expect(
      threadChangeOf(
        JSON.stringify({ o: 'org_a', t: 'thr_12345678', k: 'typing', w: 'person:usr_yao' }),
      ),
    ).toEqual({
      organizationId: 'org_a',
      threadId: 'thr_12345678',
      kind: 'typing',
      who: { kind: 'person', id: 'usr_yao' },
    });
  });
});

const WHATSAPP = [
  '21/10/2026 14:05 - Les messages et les appels sont chiffrés de bout en bout.',
  '21/10/2026 14:05 - Kossi Adjo: Les gaines sont posées',
  'côté nord.',
  '21/10/2026 14:07 - +228 90 00 00 17: IMG-20261021-WA0003.jpg (fichier joint)',
  '21/10/2026 14:08 - Yao Amegah: <Médias omis>',
].join('\n');

describe('imports and merging (FR-012, FR-013)', () => {
  it('reads WhatsApp exports from Android and iPhone, and a Telegram export', () => {
    const android = parseWhatsAppExport(WHATSAPP, { offsetMinutes: 0 });
    expect(android).toEqual([
      {
        at: new Date('2026-10-21T14:05:00Z'),
        author: 'Kossi Adjo',
        text: 'Les gaines sont posées\ncôté nord.',
        attachments: [],
      },
      {
        at: new Date('2026-10-21T14:07:00Z'),
        author: '+228 90 00 00 17',
        text: '',
        attachments: ['IMG-20261021-WA0003.jpg'],
      },
      {
        at: new Date('2026-10-21T14:08:00Z'),
        author: 'Yao Amegah',
        text: '',
        attachments: ['Médias omis'],
      },
    ]);
    const iphone = parseWhatsAppExport(
      '‎[10/21/26, 2:05:33 PM] Kossi: Hi\n[10/21/26, 2:06:00 PM] Yao: <attached: 00000012-PHOTO-2026-10-21.jpg>',
    );
    expect(iphone.map((m) => [m.at.toISOString(), m.author, m.text, m.attachments])).toEqual([
      ['2026-10-21T14:05:33.000Z', 'Kossi', 'Hi', []],
      ['2026-10-21T14:06:00.000Z', 'Yao', '', ['00000012-PHOTO-2026-10-21.jpg']],
    ]);
    const telegram = parseTelegramExport(
      JSON.stringify({
        messages: [
          { type: 'service', date: '2026-10-21T10:00:00' },
          {
            type: 'message',
            date: '2026-10-21T10:01:00',
            from: 'Kossi',
            text: ['Voir ', { text: 'le plan' }],
            file: 'files/plan.pdf',
          },
        ],
      }),
    );
    expect(telegram).toMatchObject([
      { author: 'Kossi', text: 'Voir le plan', attachments: ['plan.pdf'] },
    ]);
  });

  it('keeps an import once, by its known authors, and merges two threads keeping dates', async () => {
    const org = fresh();
    const thread = await colombe(org);
    await inOrg(org, async (tx) => {
      const messages = parseWhatsAppExport(WHATSAPP);
      const authorOf = (name: string) =>
        name === 'Kossi Adjo' ? kossi : name.includes('17') ? yao : null;
      expect(
        await importMessages(tx, org, { threadId: thread.id, via: 'whatsapp', messages, authorOf }),
      ).toEqual({ imported: 3, skipped: 0 });
      expect(
        await importMessages(tx, org, { threadId: thread.id, via: 'whatsapp', messages, authorOf }),
      ).toEqual({ imported: 0, skipped: 3 });
      const shown = await messagesOf(tx, thread.id);
      expect(shown.map((m) => [m.author.id, m.imported, m.at])).toEqual([
        ['usr_kossi', true, '2026-10-21T14:05:00.000Z'],
        ['usr_yao', true, '2026-10-21T14:07:00.000Z'],
        ['import:Yao Amegah', true, '2026-10-21T14:08:00.000Z'],
      ]);

      const other = await openThread(
        tx,
        org,
        { kind: 'group', title: 'Chantier Colombe (WhatsApp)', holder: afi },
        at(1),
      );
      await postMessage(tx, org, say(other.id, afi, 'Bienvenue'), at(2));
      await expect(
        mergeThreads(tx, org, { from: other.id, into: thread.id, by: kossi }),
      ).rejects.toBeInstanceOf(ThreadError);
      expect(
        await mergeThreads(tx, org, { from: other.id, into: thread.id, by: afi }, at(30)),
      ).toEqual({ moved: 1 });
      const merged = await messagesOf(tx, thread.id);
      expect(merged[0]).toMatchObject({ text: 'Bienvenue', at: at(2).toISOString() });
      const { rows } = await tx.query<{ state: string; merged_into: string }>(
        `select state, merged_into from kete_threads where thread_id = $1`,
        [other.id],
      );
      expect(rows[0]).toEqual({ state: 'closed', merged_into: thread.id });
    });
  });
});
