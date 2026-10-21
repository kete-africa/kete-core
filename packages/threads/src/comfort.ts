import type { Message } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { findMessage, insert, versionsOf } from './messages.js';
import { cite } from './references.js';
import { getThread, ThreadError, type Member } from './threads.js';
import { newId } from '@kete/records';

// What every chat of today has (spec 140): reactions, pins, a message taken back, voice notes'
// transcripts, a message for one person and its sharing, each member's notification level and who
// to tell, who is typing. The trace stays whole: taking a message back hides it from the thread,
// never from the proof.

type Who = Pick<Member, 'kind' | 'id'>;
const same = (a: Who, b: { kind: string; id: string }) => a.kind === b.kind && a.id === b.id;

/** The first version of a message: where its reactions, pins and deletion are kept. */
async function firstOf(db: SqlExecutor, messageId: string): Promise<Message> {
  const first = (await versionsOf(db, messageId))[0];
  if (!first) throw new ThreadError('not_found', 'No such message here.');
  return first;
}

/** A member reacts to a message with an emoji; again, nothing changes (FR-001). */
export async function react(
  db: SqlExecutor,
  organizationId: string,
  input: { messageId: string; by: Who; emoji: string },
  now = new Date(),
): Promise<void> {
  const emoji = input.emoji.trim();
  if (emoji.length === 0 || emoji.length > 16) {
    throw new ThreadError('invalid_message', 'One emoji.');
  }
  const first = await firstOf(db, input.messageId);
  await db.query(
    `insert into kete_message_reactions (organization_id, thread_id, message_id, member_kind,
       member_id, emoji, at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict do nothing`,
    [organizationId, first.thread, first.id, input.by.kind, input.by.id, emoji, now],
  );
}

/** She takes her reaction back. */
export async function unreact(
  db: SqlExecutor,
  input: { messageId: string; by: Who; emoji: string },
): Promise<void> {
  const first = await firstOf(db, input.messageId);
  await db.query(
    `delete from kete_message_reactions
      where message_id = $1 and member_kind = $2 and member_id = $3 and emoji = $4`,
    [first.id, input.by.kind, input.by.id, input.emoji.trim()],
  );
}

/** A member pins a message, once at a time (FR-002). */
export async function pinMessage(
  db: SqlExecutor,
  organizationId: string,
  input: { messageId: string; by: Who },
  now = new Date(),
): Promise<void> {
  if (input.by.kind === 'contact') throw new ThreadError('not_a_member', 'Who pins it?');
  const first = await firstOf(db, input.messageId);
  await db.query(
    `insert into kete_message_pins (pin_id, organization_id, thread_id, message_id, by_kind,
       by_id, at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (message_id) where unpinned_at is null do nothing`,
    [newId('pin'), organizationId, first.thread, first.id, input.by.kind, input.by.id, now],
  );
}

/** A member unpins it; who and when are kept. */
export async function unpinMessage(
  db: SqlExecutor,
  input: { messageId: string; by: Who },
  now = new Date(),
): Promise<void> {
  const first = await firstOf(db, input.messageId);
  await db.query(
    `update kete_message_pins
        set unpinned_at = $2, unpinned_by_kind = $3, unpinned_by_id = $4
      where message_id = $1 and unpinned_at is null`,
    [first.id, now, input.by.kind, input.by.id],
  );
}

/** A thread's pinned messages, the latest pin first. */
export async function pinsOf(
  db: SqlExecutor,
  threadId: string,
): Promise<{ message: string; by: { kind: string; id: string }; at: string }[]> {
  const { rows } = await db.query<{ message_id: string; by_kind: string; by_id: string; at: Date }>(
    `select message_id, by_kind, by_id, at from kete_message_pins
      where thread_id = $1 and unpinned_at is null order by at desc`,
    [threadId],
  );
  return rows.map((row) => ({
    message: row.message_id,
    by: { kind: row.by_kind, id: row.by_id },
    at: new Date(row.at).toISOString(),
  }));
}

/**
 * Its author takes a message back (FR-003): every version is marked, the thread shows « Message
 * supprimé »; the words stay in the trace and the export. Once.
 */
export async function deleteMessage(
  db: SqlExecutor,
  organizationId: string,
  input: { messageId: string; by: Who },
  now = new Date(),
): Promise<void> {
  const versions = await versionsOf(db, input.messageId);
  const first = versions[0];
  if (!first) throw new ThreadError('not_found', 'No such message here.');
  if (!same(input.by, first.author)) {
    throw new ThreadError('not_the_author', 'Only its author takes a message back.');
  }
  for (const version of versions) {
    await db.query(
      `insert into kete_message_deletions (organization_id, message_id, thread_id, by_kind, by_id,
         at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict do nothing`,
      [organizationId, version.id, version.thread, input.by.kind, input.by.id, now],
    );
  }
}

/** A voice note's words, once transcribed (FR-004); the first transcript stays. */
export async function setTranscript(
  db: SqlExecutor,
  organizationId: string,
  input: { messageId: string; fileId: string; text: string },
  now = new Date(),
): Promise<void> {
  const message = await findMessage(db, input.messageId);
  if (!message?.attachments?.some((file) => file.id === input.fileId)) {
    throw new ThreadError('not_found', 'No such voice note in this message.');
  }
  await db.query(
    `insert into kete_message_transcripts (organization_id, thread_id, message_id, file_id, text,
       at)
     values ($1, $2, $3, $4, $5, $6)
     on conflict do nothing`,
    [organizationId, message.thread, message.id, input.fileId, input.text.slice(0, 20000), now],
  );
}

/**
 * The person a message was only for shares it with the thread (FR-010): the same words, for every
 * member, naming who shared it. Once.
 */
export async function shareMessage(
  db: SqlExecutor,
  organizationId: string,
  input: { messageId: string; by: Who },
  now = new Date(),
): Promise<Message> {
  const original = await findMessage(db, input.messageId);
  if (!original) throw new ThreadError('not_found', 'No such message here.');
  if (!original.only_for || !same(input.by, original.only_for)) {
    throw new ThreadError('not_the_author', 'Only the one it was for shares it.');
  }
  const { rows: done } = await db.query<{ shared_message_id: string }>(
    `select shared_message_id from kete_message_shares where message_id = $1`,
    [original.id],
  );
  if (done[0]) {
    const already = await findMessage(db, done[0].shared_message_id);
    if (already) return already;
  }
  const { only_for: _only, id: _id, at: _at, ...kept } = original;
  void _only;
  void _id;
  void _at;
  const message: Message = { ...kept, id: newId('msg'), at: now.toISOString() };
  await insert(db, organizationId, message);
  await cite(db, organizationId, message);
  await db.query(
    `insert into kete_message_shares (organization_id, message_id, shared_message_id, by_kind,
       by_id, at)
     values ($1, $2, $3, $4, $5, $6)`,
    [organizationId, original.id, message.id, input.by.kind, input.by.id, now],
  );
  return message;
}

/** How much a member of a thread wants to be told (FR-011). */
export type NotifyLevel = 'all' | 'mentions' | 'none';

/** She sets her level for a thread. */
export async function setNotifyLevel(
  db: SqlExecutor,
  organizationId: string,
  input: { threadId: string; member: Who; level: NotifyLevel },
): Promise<void> {
  await db.query(
    `insert into kete_thread_prefs (organization_id, thread_id, member_kind, member_id, notify)
     values ($1, $2, $3, $4, $5)
     on conflict (thread_id, member_kind, member_id) do update set notify = excluded.notify`,
    [organizationId, input.threadId, input.member.kind, input.member.id, input.level],
  );
}

/** Her level for a thread; `all` until she says otherwise. */
export async function notifyLevelOf(
  db: SqlExecutor,
  threadId: string,
  member: Who,
): Promise<NotifyLevel> {
  const { rows } = await db.query<{ notify: NotifyLevel }>(
    `select notify from kete_thread_prefs
      where thread_id = $1 and member_kind = $2 and member_id = $3`,
    [threadId, member.kind, member.id],
  );
  return rows[0]?.notify ?? 'all';
}

/**
 * Who should be told of a message (FR-011): the thread's present members as their level wants it
 * — all, only when mentioned, or never — and always whoever must act on it; never its author, nor
 * who has read it, nor anyone a message only for one person is not for.
 */
export async function whoToTell(
  db: SqlExecutor,
  messageId: string,
): Promise<{ kind: 'person' | 'agent'; id: string; because: 'action' | 'mention' | 'message' }[]> {
  const versions = await versionsOf(db, messageId);
  const first = versions[0];
  const latest = versions.at(-1);
  if (!first || !latest) throw new ThreadError('not_found', 'No such message here.');
  const thread = await getThread(db, first.thread);
  if (!thread) throw new ThreadError('not_found', 'No such thread here.');
  const { rows: gone } = await db.query(
    `select 1 from kete_message_deletions where message_id = $1`,
    [first.id],
  );
  if (gone.length > 0) return [];
  const { rows: read } = await db.query<{ reader_kind: string; reader_id: string }>(
    `select reader_kind, reader_id from kete_message_reads where message_id = $1`,
    [first.id],
  );
  const { rows: levels } = await db.query<{
    member_kind: string;
    member_id: string;
    notify: NotifyLevel;
  }>(`select member_kind, member_id, notify from kete_thread_prefs where thread_id = $1`, [
    thread.id,
  ]);
  const key = (who: { kind: string; id: string }) => `${who.kind}:${who.id}`;
  const readers = new Set(read.map((r) => `${r.reader_kind}:${r.reader_id}`));
  const levelOf = new Map(levels.map((l) => [`${l.member_kind}:${l.member_id}`, l.notify]));
  const mentioned = new Set((latest.mentions ?? []).map(key));
  const acting = latest.for === 'action' ? (latest.to ?? thread.holder) : null;
  const told: {
    kind: 'person' | 'agent';
    id: string;
    because: 'action' | 'mention' | 'message';
  }[] = [];
  for (const member of thread.members ?? []) {
    if (member.until || member.kind === 'contact') continue;
    const who = { kind: member.kind, id: member.id };
    if (same(who, first.author) || readers.has(key(who))) continue;
    if (latest.only_for && !same(who, latest.only_for)) continue;
    const level = levelOf.get(key(who)) ?? 'all';
    const because =
      acting && same(who, acting)
        ? 'action'
        : mentioned.has(key(who))
          ? level === 'none'
            ? null
            : 'mention'
          : level === 'all'
            ? 'message'
            : null;
    if (because) told.push({ kind: member.kind as 'person' | 'agent', id: member.id, because });
  }
  return told;
}

/** Tells the thread who is writing (FR-007): announced on `kete_threads`, never kept. */
export async function announceTyping(
  db: SqlExecutor,
  organizationId: string,
  input: { threadId: string; member: Who },
): Promise<void> {
  await db.query(`select pg_notify('kete_threads', $1)`, [
    JSON.stringify({
      o: organizationId,
      t: input.threadId,
      k: 'typing',
      w: `${input.member.kind}:${input.member.id}`,
    }),
  ]);
}
