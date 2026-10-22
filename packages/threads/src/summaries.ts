import type { Thread } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { getThread, type Member } from './threads.js';

// The list of a member's threads (spec 139, FR-001): by their last activity, each with what she
// has not read, its last message, and how many actions asked in it are still open — a thread
// where nothing waits is shown resolved.

export interface ThreadSummary {
  thread: Thread;
  /** Messages she did not write and has not read (or marked unread). */
  unread: number;
  /** The latest words said in it, if any. */
  last: { author: { kind: string; id: string }; text: string; at: string } | null;
  /** Its last message, else its opening. */
  lastAt: string;
  /** Messages for action whose holding is not done. */
  openActions: number;
}

interface SummaryRow extends Record<string, unknown> {
  thread_id: string;
  unread: string;
  open_actions: string;
  last_at: Date;
  last_author_kind: string | null;
  last_author_id: string | null;
  last_text: string | null;
  last_message_at: Date | null;
}

const SUMMARY = `
  select t.thread_id,
    (select count(*) from kete_messages m
      where m.thread_id = t.thread_id and m.edited_from is null
        and not (m.author_kind = $1 and m.author_id = $2)
        and (m.only_for_id is null or (m.only_for_kind = $1 and m.only_for_id = $2))
        and not exists (select 1 from kete_message_deletions d where d.message_id = m.message_id)
        and (not exists (select 1 from kete_message_reads r
                          where r.message_id = m.message_id
                            and r.reader_kind = $1 and r.reader_id = $2)
             or m.at >= coalesce((select k.unread_from from kete_thread_marks k
                                   where k.thread_id = t.thread_id
                                     and k.member_kind = $1 and k.member_id = $2),
                                 'infinity'::timestamptz))) as unread,
    (select count(*) from kete_holdings h
      where h.source_app = 'threads' and h.source_kind = 'message' and h.state <> 'done'
        and h.source_ref in (select message_id from kete_messages m2
                              where m2.thread_id = t.thread_id)) as open_actions,
    l.author_kind as last_author_kind, l.author_id as last_author_id, l.text as last_text,
    l.at as last_message_at,
    greatest(t.opened_at, coalesce(l.at, t.opened_at)) as last_at
  from kete_threads t
  left join lateral (select author_kind, author_id,
                             case when exists (select 1 from kete_message_deletions d
                                                where d.message_id = m3.message_id)
                                  then '' else text end as text, at
                        from kete_messages m3
                      where m3.thread_id = t.thread_id
                        and (m3.only_for_id is null
                             or (m3.only_for_kind = $1 and m3.only_for_id = $2))
                      order by at desc, message_id desc limit 1) l
    on true`;

async function summarize(db: SqlExecutor, rows: SummaryRow[]): Promise<ThreadSummary[]> {
  const found: ThreadSummary[] = [];
  for (const row of rows) {
    const thread = await getThread(db, row.thread_id);
    if (!thread) continue;
    found.push({
      thread,
      unread: Number(row.unread),
      last:
        row.last_author_kind && row.last_author_id && row.last_message_at
          ? {
              author: { kind: row.last_author_kind, id: row.last_author_id },
              text: (row.last_text ?? '').slice(0, 200),
              at: new Date(row.last_message_at).toISOString(),
            }
          : null,
      lastAt: new Date(row.last_at).toISOString(),
      openActions: Number(row.open_actions),
    });
  }
  return found;
}

/** Her open threads, the latest activity first, each with its unread count and last message. */
export async function threadSummariesOf(
  db: SqlExecutor,
  member: Pick<Member, 'kind' | 'id'>,
): Promise<ThreadSummary[]> {
  const { rows } = await db.query<SummaryRow>(
    `${SUMMARY}
      where t.state = 'open' and exists (
        select 1 from kete_thread_members mb
         where mb.thread_id = t.thread_id and mb.member_kind = $1 and mb.member_id = $2
           and mb.until is null)
      order by last_at desc, t.thread_id`,
    [member.kind, member.id],
  );
  return summarize(db, rows);
}

/**
 * What changed in her threads since a moment (FR-006), for a product that cannot listen to
 * Postgres: the threads with a message, a read, a member or a file after it.
 */
export async function changesSince(
  db: SqlExecutor,
  member: Pick<Member, 'kind' | 'id'>,
  since: Date,
): Promise<string[]> {
  const { rows } = await db.query<{ thread_id: string }>(
    `select t.thread_id from kete_threads t
      where exists (select 1 from kete_thread_members mb
                     where mb.thread_id = t.thread_id and mb.member_kind = $1
                       and mb.member_id = $2 and mb.until is null)
        and (t.closed_at > $3
          or exists (select 1 from kete_messages m where m.thread_id = t.thread_id and m.at > $3)
          or exists (select 1 from kete_message_reads r join kete_messages m using (message_id)
                      where m.thread_id = t.thread_id and r.at > $3)
          or exists (select 1 from kete_thread_members x where x.thread_id = t.thread_id
                       and (x.since > $3 or x.until > $3))
          or exists (select 1 from kete_thread_files f where f.thread_id = t.thread_id
                       and f.at > $3))
      order by t.thread_id`,
    [member.kind, member.id, since],
  );
  return rows.map((r) => r.thread_id);
}
