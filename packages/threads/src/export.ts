import { createHash } from 'node:crypto';
import type { Message, Thread } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { getThread, ThreadError } from './threads.js';

// A thread exported as proof (spec 113, FR-002): its journal — the thread, who was a member and
// when, every message in every version, who read each and when — fingerprinted, and a page the
// product turns into a timestamped PDF (Gotenberg, through `@kete/files`). Nothing is left out.

const words = {
  fr: {
    title: (t: string) => `Fil « ${t} » — journal`,
    generated: 'Exporté le',
    fingerprint: 'Empreinte SHA-256 du journal',
    members: 'Membres',
    since: 'depuis',
    until: 'jusqu’au',
    messages: 'Messages',
    edited: (id: string) => `modifie ${id}`,
    forAction: 'pour action',
    forInformation: 'pour information',
    readBy: 'lu par',
    nobodyRead: 'lu par personne',
  },
  en: {
    title: (t: string) => `Thread “${t}” — journal`,
    generated: 'Exported on',
    fingerprint: 'SHA-256 fingerprint of the journal',
    members: 'Members',
    since: 'since',
    until: 'until',
    messages: 'Messages',
    edited: (id: string) => `edits ${id}`,
    forAction: 'for action',
    forInformation: 'for information',
    readBy: 'read by',
    nobodyRead: 'read by nobody',
  },
} as const;

export interface ThreadJournal {
  thread: Thread;
  /** Every message in every version, in the order they were said. */
  messages: (Message & { readBy: { kind: string; id: string; at: string }[] })[];
  generatedAt: string;
}

export interface ThreadExport {
  journal: ThreadJournal;
  /** SHA-256 of the journal as JSON: whoever holds the export can check it was not changed. */
  fingerprint: string;
  /** The page to print as PDF. */
  html: string;
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function exportThread(
  db: SqlExecutor,
  threadId: string,
  options: { locale?: 'fr' | 'en'; now?: Date } = {},
): Promise<ThreadExport> {
  const thread = await getThread(db, threadId);
  if (!thread) throw new ThreadError('not_found', 'No such thread here.');
  const { rows } = await db.query<{
    message_id: string;
    author_kind: Message['author']['kind'];
    author_id: string;
    text: string;
    attachments: NonNullable<Message['attachments']>;
    for_what: Message['for'];
    via: Message['via'];
    edited_from: string | null;
    at: Date;
    reads: { kind: string; id: string; at: string }[];
  }>(
    `select m.message_id, m.author_kind, m.author_id, m.text, m.attachments, m.for_what, m.via,
            m.edited_from, m.at,
            coalesce((select jsonb_agg(jsonb_build_object('kind', r.reader_kind, 'id', r.reader_id,
                        'at', to_char(r.at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
                        order by r.at, r.reader_id)
                        from kete_message_reads r where r.message_id = m.message_id), '[]') as reads
       from kete_messages m where m.thread_id = $1 order by m.at, m.message_id`,
    [threadId],
  );
  const journal: ThreadJournal = {
    thread,
    messages: rows.map((r) => ({
      id: r.message_id,
      thread: threadId,
      author: { kind: r.author_kind, id: r.author_id },
      text: r.text,
      ...(r.attachments.length > 0 ? { attachments: r.attachments } : {}),
      for: r.for_what,
      via: r.via,
      ...(r.edited_from ? { edited_from: r.edited_from } : {}),
      at: new Date(r.at).toISOString(),
      readBy: r.reads,
    })),
    generatedAt: (options.now ?? new Date()).toISOString(),
  };
  const fingerprint = createHash('sha256').update(JSON.stringify(journal)).digest('hex');
  const w = words[options.locale ?? 'fr'];
  const who = (p: { kind: string; id: string }) => escape(`${p.id} (${p.kind})`);
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escape(w.title(thread.title))}</title>
<style>body{font-family:Arial,sans-serif;font-size:10pt;margin:1.5cm;color:#1f1f1f}
h1{font-size:14pt}h2{font-size:12pt;margin-top:1.2em}li{margin:.3em 0}
.meta{color:#555}.text{white-space:pre-wrap}</style></head><body>
<h1>${escape(w.title(thread.title))}</h1>
<p class="meta">${w.generated} ${escape(journal.generatedAt)}<br>${w.fingerprint} : ${fingerprint}</p>
<h2>${w.members}</h2><ul>${(thread.members ?? [])
    .map(
      (m) =>
        `<li>${who(m)} — ${w.since} ${escape(m.since)}${m.until ? `, ${w.until} ${escape(m.until)}` : ''}</li>`,
    )
    .join('')}</ul>
<h2>${w.messages}</h2><ol>${journal.messages
    .map(
      (m) =>
        `<li><p class="meta">${escape(m.at)} · ${who(m.author)} · ${m.via} · ${
          m.for === 'action' ? w.forAction : w.forInformation
        }${m.edited_from ? ` · ${w.edited(escape(m.edited_from))}` : ''} · ${escape(m.id)}</p>
<p class="text">${escape(m.text)}</p><p class="meta">${
          m.readBy.length > 0
            ? `${w.readBy} ${m.readBy.map((r) => `${who(r)} ${escape(r.at)}`).join(', ')}`
            : w.nobodyRead
        }</p></li>`,
    )
    .join('')}</ol></body></html>`;
  return { journal, fingerprint, html };
}
