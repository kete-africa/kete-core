import { newId } from '@kete/records';
import { validateThread, type Thread } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';

// Threads (spec 113, FR-001; doctrine D-057): where people talk about one thing. An object's thread
// is born with it and put away when it closes; a group comes from the structure or is created; a
// direct thread is between two; each person has her thread with Kete. A thread always has a
// holder. Its members say who knew, and since when: one who leaves keeps her dates.

export type ThreadKind = Thread['kind'];
export type Holder = Thread['holder'];
export type MemberKind = 'person' | 'agent' | 'contact';
export interface Member {
  kind: MemberKind;
  id: string;
  role?: 'member' | 'subscriber';
}

export class ThreadError extends Error {
  constructor(
    readonly code:
      | 'invalid_thread'
      | 'not_found'
      | 'closed'
      | 'not_the_author'
      | 'invalid_message'
      | 'already_edited'
      | 'already_moved'
      | 'not_a_member'
      | 'file_too_large',
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
    this.name = 'ThreadError';
  }
}

interface ThreadRow extends Record<string, unknown> {
  thread_id: string;
  kind: ThreadKind;
  object_kind: string | null;
  object_id: string | null;
  title: string;
  holder_kind: Holder['kind'];
  holder_id: string;
  address: string | null;
  retention: string | null;
  state: Thread['state'];
  opened_at: Date;
  closed_at: Date | null;
}

interface MemberRow extends Record<string, unknown> {
  member_kind: MemberKind;
  member_id: string;
  role: 'member' | 'subscriber';
  since: Date;
  until: Date | null;
}

const THREAD_COLUMNS = `thread_id, kind, object_kind, object_id, title, holder_kind, holder_id,
  address, retention, state, opened_at, closed_at`;

function toThread(row: ThreadRow, members: MemberRow[]): Thread {
  return {
    id: row.thread_id,
    kind: row.kind,
    ...(row.object_kind && row.object_id
      ? { object: { kind: row.object_kind, id: row.object_id } }
      : {}),
    title: row.title,
    holder: { kind: row.holder_kind, id: row.holder_id },
    members: members.map((m) => ({
      kind: m.member_kind,
      id: m.member_id,
      role: m.role,
      since: new Date(m.since).toISOString(),
      ...(m.until ? { until: new Date(m.until).toISOString() } : {}),
    })),
    ...(row.address ? { address: row.address } : {}),
    ...(row.retention ? { retention: row.retention } : {}),
    state: row.state,
    opened_at: new Date(row.opened_at).toISOString(),
    ...(row.closed_at ? { closed_at: new Date(row.closed_at).toISOString() } : {}),
  };
}

/** A thread with every member it ever had, the earliest first. */
export async function getThread(db: SqlExecutor, threadId: string): Promise<Thread | null> {
  const { rows } = await db.query<ThreadRow>(
    `select ${THREAD_COLUMNS} from kete_threads where thread_id = $1`,
    [threadId],
  );
  if (!rows[0]) return null;
  const { rows: members } = await db.query<MemberRow>(
    `select member_kind, member_id, role, since, until from kete_thread_members
      where thread_id = $1 order by since, member_kind, member_id`,
    [threadId],
  );
  return toThread(rows[0], members);
}

/** The thread of an object, if it has one. */
export async function threadOf(
  db: SqlExecutor,
  object: { kind: string; id: string },
): Promise<Thread | null> {
  const { rows } = await db.query<{ thread_id: string }>(
    `select thread_id from kete_threads
      where kind = 'object' and object_kind = $1 and object_id = $2`,
    [object.kind, object.id],
  );
  return rows[0] ? getThread(db, rows[0].thread_id) : null;
}

/** The thread an address for replies by mail names, if any. */
export async function threadAt(db: SqlExecutor, address: string): Promise<Thread | null> {
  const { rows } = await db.query<{ thread_id: string }>(
    `select thread_id from kete_threads where address = $1`,
    [address.trim().toLowerCase()],
  );
  return rows[0] ? getThread(db, rows[0].thread_id) : null;
}

/** Whether someone is a member of a thread now. */
async function isMember(db: SqlExecutor, threadId: string, member: Member): Promise<boolean> {
  const { rows } = await db.query(
    `select 1 from kete_thread_members
      where thread_id = $1 and member_kind = $2 and member_id = $3 and until is null`,
    [threadId, member.kind, member.id],
  );
  return rows.length > 0;
}

/** Someone joins a thread, from now; already a member, nothing changes. */
export async function joinThread(
  db: SqlExecutor,
  organizationId: string,
  threadId: string,
  member: Member,
  now = new Date(),
): Promise<void> {
  if (await isMember(db, threadId, member)) return;
  await db.query(
    `insert into kete_thread_members (organization_id, thread_id, member_kind, member_id, role,
       since)
     values ($1, $2, $3, $4, $5, $6)`,
    [organizationId, threadId, member.kind, member.id, member.role ?? 'member', now],
  );
}

/** Someone leaves a thread: she keeps the dates she knew. */
export async function leaveThread(
  db: SqlExecutor,
  threadId: string,
  member: Pick<Member, 'kind' | 'id'>,
  now = new Date(),
): Promise<void> {
  await db.query(
    `update kete_thread_members set until = $4
      where thread_id = $1 and member_kind = $2 and member_id = $3 and until is null`,
    [threadId, member.kind, member.id, now],
  );
}

export interface OpenThreadInput {
  kind: ThreadKind;
  title: string;
  holder: Holder;
  object?: { kind: string; id: string };
  members?: Member[];
  /** Its own address for replies by mail (`<local>@<domain>`); the product names its domain. */
  address?: string;
  retention?: string;
}

/**
 * Opens a thread, its holder a member from the start. An object has one thread: opening it again
 * gives the one it has, still open or put away.
 */
export async function openThread(
  db: SqlExecutor,
  organizationId: string,
  input: OpenThreadInput,
  now = new Date(),
): Promise<Thread> {
  if (input.kind === 'object' && input.object) {
    const existing = await threadOf(db, input.object);
    if (existing) return existing;
  }
  const threadId = newId('thr');
  const candidate = {
    id: threadId,
    kind: input.kind,
    ...(input.object ? { object: input.object } : {}),
    title: input.title,
    holder: input.holder,
    ...(input.address ? { address: input.address.trim().toLowerCase() } : {}),
    ...(input.retention ? { retention: input.retention } : {}),
    state: 'open' as const,
    opened_at: now.toISOString(),
  };
  const checked = validateThread(candidate);
  if (!checked.ok || (input.kind === 'object') !== Boolean(input.object)) {
    throw new ThreadError(
      'invalid_thread',
      'The thread does not fit thread.v1.',
      checked.ok ? ['An object thread, and only one, names its object.'] : checked.errors,
    );
  }
  await db.query(
    `insert into kete_threads (thread_id, organization_id, kind, object_kind, object_id, title,
       holder_kind, holder_id, address, retention, opened_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      threadId,
      organizationId,
      input.kind,
      input.object?.kind ?? null,
      input.object?.id ?? null,
      input.title,
      input.holder.kind,
      input.holder.id,
      candidate.address ?? null,
      input.retention ?? null,
      now,
    ],
  );
  for (const member of [input.holder, ...(input.members ?? [])]) {
    await joinThread(db, organizationId, threadId, member, now);
  }
  return (await getThread(db, threadId)) as Thread;
}

/** A thread changes hands: its new holder becomes a member. */
export async function setThreadHolder(
  db: SqlExecutor,
  organizationId: string,
  threadId: string,
  holder: Holder,
  now = new Date(),
): Promise<Thread> {
  const { rows } = await db.query(
    `update kete_threads set holder_kind = $2, holder_id = $3 where thread_id = $1
     returning thread_id`,
    [threadId, holder.kind, holder.id],
  );
  if (rows.length === 0) throw new ThreadError('not_found', 'No such thread here.');
  await joinThread(db, organizationId, threadId, holder, now);
  return (await getThread(db, threadId)) as Thread;
}

/** A thread is put away with its object: it is kept, nothing more is said in it. */
export async function closeThread(
  db: SqlExecutor,
  threadId: string,
  now = new Date(),
): Promise<Thread> {
  await db.query(
    `update kete_threads set state = 'closed', closed_at = $2
      where thread_id = $1 and state = 'open'`,
    [threadId, now],
  );
  const thread = await getThread(db, threadId);
  if (!thread) throw new ThreadError('not_found', 'No such thread here.');
  return thread;
}

/** The open threads someone is a member of now, the latest opened first. */
export async function threadsOf(
  db: SqlExecutor,
  member: Pick<Member, 'kind' | 'id'>,
): Promise<Thread[]> {
  const { rows } = await db.query<{ thread_id: string }>(
    `select t.thread_id from kete_threads t
      where t.state = 'open' and exists (
        select 1 from kete_thread_members m
         where m.thread_id = t.thread_id and m.member_kind = $1 and m.member_id = $2
           and m.until is null)
      order by t.opened_at desc, t.thread_id`,
    [member.kind, member.id],
  );
  const found: Thread[] = [];
  for (const row of rows) found.push((await getThread(db, row.thread_id)) as Thread);
  return found;
}
