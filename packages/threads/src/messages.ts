import { newId } from '@kete/records';
import { validateMessage, type Message } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { sayHolding } from '@kete/work';
import { getThread, joinThread, ThreadError, type Member } from './threads.js';

// Messages (spec 113, FR-002; doctrine D-057): a trace at least as good as mail. A message is
// never rewritten — an edit is a new message naming the one it replaces, the original kept —;
// « read by » keeps who read it and when; « for action » makes a holding for whoever must act, the
// thread's holder unless named; « for information » tells. Whoever writes in a thread is one of
// its members from then on.

interface MessageRow extends Record<string, unknown> {
  message_id: string;
  thread_id: string;
  author_kind: Message['author']['kind'];
  author_id: string;
  text: string;
  attachments: NonNullable<Message['attachments']>;
  for_what: Message['for'];
  to_kind: 'person' | 'agent' | null;
  to_id: string | null;
  via: Message['via'];
  visibility: NonNullable<Message['visibility']>;
  reply_to: string | null;
  edited_from: string | null;
  moved_from: string | null;
  mentions: NonNullable<Message['mentions']>;
  at: Date;
}

const COLUMNS = `message_id, thread_id, author_kind, author_id, text, attachments, for_what,
  to_kind, to_id, via, visibility, reply_to, edited_from, moved_from, mentions, at`;

function toMessage(row: MessageRow): Message {
  return {
    id: row.message_id,
    thread: row.thread_id,
    author: { kind: row.author_kind, id: row.author_id },
    text: row.text,
    ...(row.attachments.length > 0 ? { attachments: row.attachments } : {}),
    for: row.for_what,
    ...(row.to_kind && row.to_id ? { to: { kind: row.to_kind, id: row.to_id } } : {}),
    via: row.via,
    visibility: row.visibility,
    ...(row.reply_to ? { reply_to: row.reply_to } : {}),
    ...(row.edited_from ? { edited_from: row.edited_from } : {}),
    ...(row.moved_from ? { moved_from: row.moved_from } : {}),
    ...(row.mentions.length > 0 ? { mentions: row.mentions } : {}),
    at: new Date(row.at).toISOString(),
  };
}

/** What a message says, as its author gives it. */
export type SaidMessage = Omit<Message, 'id' | 'at' | 'edited_from' | 'moved_from'>;

/** A contact's own words are said outside; anything else is internal unless its author says so. */
const visibilityOf = (said: SaidMessage): NonNullable<Message['visibility']> =>
  said.author.kind === 'contact' ? 'outside' : (said.visibility ?? 'internal');

/** The holding a message « for action » makes: under the first version of the message. */
async function sayAction(
  db: SqlExecutor,
  organizationId: string,
  message: Message,
  root: string,
  now: Date,
): Promise<string> {
  const thread = await getThread(db, message.thread);
  if (!thread) throw new ThreadError('not_found', 'No such thread here.');
  const holding = await sayHolding(
    db,
    organizationId,
    {
      source: { app: 'threads', kind: 'message', ref: root },
      object: thread.object ?? { kind: 'thread', id: thread.id },
      what: (message.text.trim() || thread.title).slice(0, 300),
      holder: message.to ?? thread.holder,
      state: 'held',
      for: 'action',
    },
    now,
  );
  return holding.holdingId;
}

/**
 * Posts a message in an open thread. Its author becomes a member; a message « for action » makes a
 * holding for whoever must act. The answer gives the holding's id when there is one.
 */
export async function postMessage(
  db: SqlExecutor,
  organizationId: string,
  said: SaidMessage,
  now = new Date(),
): Promise<{ message: Message; holdingId: string | null }> {
  const message: Message = {
    ...said,
    visibility: visibilityOf(said),
    id: newId('msg'),
    at: now.toISOString(),
  };
  const checked = validateMessage(message);
  if (!checked.ok) {
    throw new ThreadError(
      'invalid_message',
      'The message does not fit message.v1.',
      checked.errors,
    );
  }
  const thread = await getThread(db, said.thread);
  if (!thread) throw new ThreadError('not_found', 'No such thread here.');
  if (thread.state === 'closed') throw new ThreadError('closed', 'This thread is put away.');
  await insert(db, organizationId, message);
  await joinThread(db, organizationId, thread.id, said.author as Member, now);
  // Whoever must act knows: she is a member too; so is whoever is mentioned (spec 139, FR-003).
  if (said.for === 'action' && said.to) {
    await joinThread(db, organizationId, thread.id, said.to, now);
  }
  for (const mentioned of said.mentions ?? []) {
    await joinThread(db, organizationId, thread.id, mentioned, now);
  }
  // Writing reads the thread up to one's own words (FR-001).
  await markRead(db, organizationId, { threadId: thread.id, reader: said.author }, now);
  const holdingId =
    said.for === 'action' ? await sayAction(db, organizationId, message, message.id, now) : null;
  return { message, holdingId };
}

async function insert(db: SqlExecutor, organizationId: string, message: Message): Promise<void> {
  await db.query(
    `insert into kete_messages (message_id, organization_id, thread_id, author_kind, author_id,
       text, attachments, for_what, to_kind, to_id, via, reply_to, edited_from, mentions, at,
       visibility, moved_from)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      message.id,
      organizationId,
      message.thread,
      message.author.kind,
      message.author.id,
      message.text,
      JSON.stringify(message.attachments ?? []),
      message.for,
      message.to?.kind ?? null,
      message.to?.id ?? null,
      message.via,
      message.reply_to ?? null,
      message.edited_from ?? null,
      JSON.stringify(message.mentions ?? []),
      message.at,
      message.visibility ?? 'internal',
      message.moved_from ?? null,
    ],
  );
}

async function findMessage(db: SqlExecutor, messageId: string): Promise<Message | null> {
  const { rows } = await db.query<MessageRow>(
    `select ${COLUMNS} from kete_messages where message_id = $1`,
    [messageId],
  );
  return rows[0] ? toMessage(rows[0]) : null;
}

/** The versions of a message, the first first: the chain of its edits. */
export async function versionsOf(db: SqlExecutor, messageId: string): Promise<Message[]> {
  const { rows } = await db.query<MessageRow>(
    `with recursive back as (
       select ${COLUMNS} from kete_messages where message_id = $1
       union all
       select m.message_id, m.thread_id, m.author_kind, m.author_id, m.text, m.attachments,
              m.for_what, m.to_kind, m.to_id, m.via, m.visibility, m.reply_to, m.edited_from,
              m.moved_from, m.mentions, m.at
         from kete_messages m join back b on m.message_id = b.edited_from
     ),
     forth as (
       select ${COLUMNS} from kete_messages where message_id = $1
       union all
       select m.message_id, m.thread_id, m.author_kind, m.author_id, m.text, m.attachments,
              m.for_what, m.to_kind, m.to_id, m.via, m.visibility, m.reply_to, m.edited_from,
              m.moved_from, m.mentions, m.at
         from kete_messages m join forth f on m.edited_from = f.message_id
     )
     select * from back union select * from forth order by at, message_id`,
    [messageId],
  );
  return rows.map(toMessage);
}

/**
 * Its author edits a message: a new version naming the one it replaces; the original is kept, and
 * the holding it made says the new words.
 */
export async function editMessage(
  db: SqlExecutor,
  organizationId: string,
  input: { messageId: string; by: Pick<Member, 'kind' | 'id'>; text: string },
  now = new Date(),
): Promise<Message> {
  const before = await findMessage(db, input.messageId);
  if (!before) throw new ThreadError('not_found', 'No such message here.');
  if (before.author.kind !== input.by.kind || before.author.id !== input.by.id) {
    throw new ThreadError('not_the_author', 'Only its author edits a message.');
  }
  const { rows: later } = await db.query(`select 1 from kete_messages where edited_from = $1`, [
    before.id,
  ]);
  if (later.length > 0) {
    throw new ThreadError('already_edited', 'Edit its latest version.');
  }
  const thread = await getThread(db, before.thread);
  if (thread?.state === 'closed') throw new ThreadError('closed', 'This thread is put away.');
  const { id, at, ...kept } = before;
  void at;
  const message: Message = {
    ...kept,
    text: input.text,
    edited_from: id,
    id: newId('msg'),
    at: now.toISOString(),
  };
  const checked = validateMessage(message);
  if (!checked.ok) {
    throw new ThreadError(
      'invalid_message',
      'The message does not fit message.v1.',
      checked.errors,
    );
  }
  await insert(db, organizationId, message);
  if (message.for === 'action') {
    const root = (await versionsOf(db, message.id))[0]?.id ?? id;
    await sayAction(db, organizationId, message, root, now);
  }
  return message;
}

/** A message as a thread shows it: its latest version, how many times edited, who read it. */
export interface Shown extends Message {
  /** The first version's id: where its edits, its reads and its holding are found. */
  first: string;
  edits: number;
  readBy: { kind: Member['kind']; id: string; at: string }[];
  /** Moved to another thread: the original stays here, saying where it went (FR-005). */
  movedTo?: { thread: string; message: string; at: string };
}

/** The messages of a thread, each in its latest version, in the order they were first said. */
export async function messagesOf(db: SqlExecutor, threadId: string): Promise<Shown[]> {
  const { rows } = await db.query<MessageRow>(
    `select ${COLUMNS} from kete_messages where thread_id = $1 order by at, message_id`,
    [threadId],
  );
  const all = rows.map(toMessage);
  const next = new Map(all.filter((m) => m.edited_from).map((m) => [m.edited_from as string, m]));
  const { rows: readRows } = await db.query<{
    message_id: string;
    reader_kind: Member['kind'];
    reader_id: string;
    at: Date;
  }>(
    `select r.message_id, r.reader_kind, r.reader_id, r.at from kete_message_reads r
       join kete_messages m on m.message_id = r.message_id
      where m.thread_id = $1 order by r.at, r.reader_id`,
    [threadId],
  );
  const { rows: moveRows } = await db.query<{
    message_id: string;
    to_thread: string;
    moved_message_id: string;
    at: Date;
  }>(
    `select message_id, to_thread, moved_message_id, at from kete_message_moves
      where thread_id = $1`,
    [threadId],
  );
  const moved = new Map(moveRows.map((r) => [r.message_id, r]));
  return all
    .filter((m) => !m.edited_from)
    .map((first) => {
      let latest = first;
      let edits = 0;
      for (let n = next.get(latest.id); n; n = next.get(latest.id)) {
        latest = n;
        edits += 1;
      }
      const move = moved.get(first.id);
      return {
        ...latest,
        first: first.id,
        edits,
        ...(move
          ? {
              movedTo: {
                thread: move.to_thread,
                message: move.moved_message_id,
                at: new Date(move.at).toISOString(),
              },
            }
          : {}),
        readBy: readRows
          .filter((r) => r.message_id === first.id)
          .map((r) => ({ kind: r.reader_kind, id: r.reader_id, at: new Date(r.at).toISOString() })),
      };
    });
}

/**
 * Someone reads a thread: every message she did not write is read by her, once, at that moment —
 * kept under the message's first version.
 */
export async function markRead(
  db: SqlExecutor,
  organizationId: string,
  input: { threadId: string; reader: Pick<Member, 'kind' | 'id'> },
  now = new Date(),
): Promise<number> {
  const { rows } = await db.query(
    `insert into kete_message_reads (organization_id, message_id, reader_kind, reader_id, at)
     select $1, message_id, $3, $4, $5 from kete_messages
      where thread_id = $2 and edited_from is null
        and not (author_kind = $3 and author_id = $4)
     on conflict do nothing
     returning message_id`,
    [organizationId, input.threadId, input.reader.kind, input.reader.id, now],
  );
  await db.query(
    `delete from kete_thread_marks where thread_id = $1 and member_kind = $2 and member_id = $3`,
    [input.threadId, input.reader.kind, input.reader.id],
  );
  return rows.length;
}

/**
 * She marks a thread unread from a message on (FR-001): her own way of reading, kept apart from
 * the trace — « read by » keeps when she read it.
 */
export async function markUnread(
  db: SqlExecutor,
  organizationId: string,
  input: { messageId: string; reader: Pick<Member, 'kind' | 'id'> },
): Promise<void> {
  const message = await findMessage(db, input.messageId);
  if (!message) throw new ThreadError('not_found', 'No such message here.');
  await db.query(
    `insert into kete_thread_marks (organization_id, thread_id, member_kind, member_id, unread_from)
     values ($1, $2, $3, $4, $5)
     on conflict (thread_id, member_kind, member_id)
       do update set unread_from = excluded.unread_from`,
    [organizationId, message.thread, input.reader.kind, input.reader.id, message.at],
  );
}

/**
 * A message said in the wrong thread goes to the right one (FR-005), moved by its author or the
 * holder of the thread it was said in: the target gets it, naming where it came from; the source
 * keeps the original and where it went. A message moves once.
 */
export async function moveMessage(
  db: SqlExecutor,
  organizationId: string,
  input: { messageId: string; to: string; by: Pick<Member, 'kind' | 'id'> },
  now = new Date(),
): Promise<Message> {
  const versions = await versionsOf(db, input.messageId);
  const first = versions[0];
  const latest = versions.at(-1);
  if (!first || !latest) throw new ThreadError('not_found', 'No such message here.');
  const source = await getThread(db, first.thread);
  if (!source) throw new ThreadError('not_found', 'No such thread here.');
  const byAuthor = first.author.kind === input.by.kind && first.author.id === input.by.id;
  const byHolder = source.holder.kind === input.by.kind && source.holder.id === input.by.id;
  if (!byAuthor && !byHolder) {
    throw new ThreadError('not_the_author', 'Its author or the thread’s holder moves it.');
  }
  const target = await getThread(db, input.to);
  if (!target || target.id === source.id) throw new ThreadError('not_found', 'Which thread?');
  if (target.state === 'closed') throw new ThreadError('closed', 'This thread is put away.');
  const { rows: done } = await db.query(`select 1 from kete_message_moves where message_id = $1`, [
    first.id,
  ]);
  if (done.length > 0) throw new ThreadError('already_moved', 'This message was moved already.');
  const message: Message = {
    thread: target.id,
    author: latest.author,
    text: latest.text,
    ...(latest.attachments ? { attachments: latest.attachments } : {}),
    for: 'information',
    via: latest.via,
    visibility: latest.visibility ?? 'internal',
    ...(latest.mentions ? { mentions: latest.mentions } : {}),
    moved_from: first.id,
    id: newId('msg'),
    at: now.toISOString(),
  };
  await insert(db, organizationId, message);
  await db.query(
    `insert into kete_message_moves (organization_id, message_id, thread_id, to_thread,
       moved_message_id, by_kind, by_id, at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [organizationId, first.id, source.id, target.id, message.id, input.by.kind, input.by.id, now],
  );
  await joinThread(db, organizationId, target.id, input.by as Member, now);
  return message;
}

/**
 * Messages whose words match, the closest first, each in the version that matched — full text,
 * whatever the language (`simple` dictionary). A thread may narrow it.
 */
export async function searchMessages(
  db: SqlExecutor,
  query: { text: string; threadId?: string; limit?: number },
): Promise<Message[]> {
  const { rows } = await db.query<MessageRow>(
    `select ${COLUMNS} from kete_messages
      where search @@ websearch_to_tsquery('simple', $1)
        and ($2::text is null or thread_id = $2)
      order by ts_rank(search, websearch_to_tsquery('simple', $1)) desc, at desc
      limit $3`,
    [query.text, query.threadId ?? null, Math.min(Math.max(query.limit ?? 20, 1), 100)],
  );
  return rows.map(toMessage);
}
