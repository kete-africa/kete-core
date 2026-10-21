import type { Message } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { getThread, ThreadError, threadOf, type Member } from './threads.js';

// What a message cites with « # », and the objects a thread is attached to (spec 140, FR-005): a
// project, a third party, a ticket, an invoice… An object keeps « Cité dans »: the messages that
// cite it, the latest first. The product shows each object in its state of now, to who may read it.

export interface CitedObject {
  kind: string;
  id: string;
  /** The app the object lives in; absent: the center. */
  app?: string;
}

/** Keeps what a message cites, for the objects to find it (called when a message is kept). */
export async function cite(
  db: SqlExecutor,
  organizationId: string,
  message: Message,
): Promise<void> {
  for (const object of message.references ?? []) {
    await db.query(
      `insert into kete_message_references (organization_id, message_id, thread_id, object_kind,
         object_id, app, at)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict do nothing`,
      [
        organizationId,
        message.id,
        message.thread,
        object.kind,
        object.id,
        object.app ?? null,
        message.at,
      ],
    );
  }
}

/** Where an object was cited: the messages, the latest first — never one taken back. */
export async function citedIn(
  db: SqlExecutor,
  object: { kind: string; id: string },
  options: { limit?: number; viewer?: Pick<Member, 'kind' | 'id'> } = {},
): Promise<
  { thread: string; message: string; author: { kind: string; id: string }; at: string }[]
> {
  const { rows } = await db.query<{
    thread_id: string;
    message_id: string;
    author_kind: string;
    author_id: string;
    at: Date;
  }>(
    `select r.thread_id, r.message_id, m.author_kind, m.author_id, r.at
       from kete_message_references r join kete_messages m using (message_id)
      where r.object_kind = $1 and r.object_id = $2
        and not exists (select 1 from kete_message_deletions d where d.message_id = r.message_id)
        and ($4::text is null or m.only_for_id is null
             or (m.only_for_kind = $4 and m.only_for_id = $5))
      order by r.at desc, r.message_id desc
      limit $3`,
    [
      object.kind,
      object.id,
      Math.min(Math.max(options.limit ?? 50, 1), 200),
      options.viewer?.kind ?? null,
      options.viewer?.id ?? null,
    ],
  );
  return rows.map((row) => ({
    thread: row.thread_id,
    message: row.message_id,
    author: { kind: row.author_kind, id: row.author_id },
    at: new Date(row.at).toISOString(),
  }));
}

/** Attaches a thread to one more object: the committee's thread to three projects. */
export async function attachThread(
  db: SqlExecutor,
  organizationId: string,
  input: { threadId: string; object: CitedObject; by: Pick<Member, 'kind' | 'id'> },
  now = new Date(),
): Promise<void> {
  const thread = await getThread(db, input.threadId);
  if (!thread) throw new ThreadError('not_found', 'No such thread here.');
  if (input.by.kind === 'contact') throw new ThreadError('not_a_member', 'Who attaches it?');
  await db.query(
    `insert into kete_thread_links (organization_id, thread_id, object_kind, object_id, app,
       by_kind, by_id, at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict do nothing`,
    [
      organizationId,
      thread.id,
      input.object.kind,
      input.object.id,
      input.object.app ?? null,
      input.by.kind,
      input.by.id,
      now,
    ],
  );
}

/** The objects a thread is attached to, beyond its own. */
export async function linksOf(db: SqlExecutor, threadId: string): Promise<CitedObject[]> {
  const { rows } = await db.query<{ object_kind: string; object_id: string; app: string | null }>(
    `select object_kind, object_id, app from kete_thread_links where thread_id = $1 order by at`,
    [threadId],
  );
  return rows.map((row) => ({
    kind: row.object_kind,
    id: row.object_id,
    ...(row.app ? { app: row.app } : {}),
  }));
}

/** The threads of an object: its own first, then those attached to it. */
export async function threadsOfObject(
  db: SqlExecutor,
  object: { kind: string; id: string },
): Promise<string[]> {
  const own = await threadOf(db, object);
  const { rows } = await db.query<{ thread_id: string }>(
    `select thread_id from kete_thread_links where object_kind = $1 and object_id = $2
      order by at`,
    [object.kind, object.id],
  );
  return [...(own ? [own.id] : []), ...rows.map((row) => row.thread_id)].filter(
    (id, index, all) => all.indexOf(id) === index,
  );
}
