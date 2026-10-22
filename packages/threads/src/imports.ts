import { createHash } from 'node:crypto';
import { newId } from '@kete/records';
import type { Message } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { insert, messagesOf } from './messages.js';
import { getThread, joinThread, ThreadError, type Member } from './threads.js';

// The conversations people had elsewhere (spec 140, FR-012, FR-013): a WhatsApp group's export, a
// Telegram export, read line by line and kept in a thread, dated as they were said, by their
// authors when the product knows them; imported again, nothing is kept twice. And two threads that
// speak of the same thing become one.

/** One message as an export gives it. */
export interface ImportedMessage {
  at: Date;
  /** The author as the export names her: a name or a phone number. */
  author: string;
  text: string;
  /** The files the export names (sent beside it, or omitted). */
  attachments: string[];
}

const MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
// Android: « 21/10/2026 14:05 - Kossi Adjo: … », « 10/21/26, 2:05 PM - Kossi: … »
const ANDROID =
  /^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?\s?([AaPp][Mm])? - ([^:]+?): ([\s\S]*)$/;
// iPhone: « [21/10/2026 14:05:33] Kossi Adjo: … »
const IPHONE =
  /^\[(\d{1,2})[/.](\d{1,2})[/.](\d{2,4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?\s?([AaPp][Mm])?\] ([^:]+?): ([\s\S]*)$/;
const LINE_START = /^\[?\d{1,2}[/.]\d{1,2}[/.]\d{2,4},? \d{1,2}:\d{2}/;
const OMITTED =
  /^<?(médias? omis|media omitted|image absente|image omitted|vidéo absente|video omitted|audio omitted|document omitted)>?$/i;
const ATTACHED = [
  /^<(?:attached|pièce jointe)\s*:\s*([^>]+)>$/i,
  /^(\S+\.(?:jpe?g|png|webp|gif|mp4|mov|opus|ogg|m4a|mp3|pdf|docx?|xlsx?|pptx?|txt|vcf))\s*\((?:fichier joint|file attached)\)$/i,
];

/**
 * Reads a WhatsApp export (Android or iPhone, French or English). Days come first unless the
 * export says otherwise (`dayFirst: false`, or a day above 12 in the second place); lines without
 * an author (the group's notices) are left out; a line that does not start a message continues
 * the one before.
 */
export function parseWhatsAppExport(
  source: string,
  options: { dayFirst?: boolean; offsetMinutes?: number } = {},
): ImportedMessage[] {
  const lines = source
    .replace(MARKS, '')
    .replace(/[\u202f\u00a0]/g, ' ')
    .split(/\r?\n/);
  const raw: { parts: string[]; author: string; text: string }[] = [];
  for (const line of lines) {
    const found = ANDROID.exec(line) ?? IPHONE.exec(line);
    if (found) {
      const [, a, b, year, hour, minute, second, ampm, author, text] = found;
      raw.push({
        parts: [a ?? '', b ?? '', year ?? '', hour ?? '', minute ?? '', second ?? '', ampm ?? ''],
        author: (author ?? '').trim(),
        text: text ?? '',
      });
    } else if (raw.length > 0 && !LINE_START.test(line)) {
      const last = raw[raw.length - 1] as { text: string };
      last.text += `\n${line}`;
    }
  }
  const dayFirst =
    options.dayFirst ?? !raw.some((r) => Number(r.parts[1]) > 12 && Number(r.parts[0]) <= 12);
  const offset = options.offsetMinutes ?? 0;
  return raw.map((r) => {
    const [a, b, y, h, mi, se, ampm] = r.parts as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const day = Number(dayFirst ? a : b);
    const month = Number(dayFirst ? b : a);
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    let hours = Number(h) % (ampm ? 12 : 24);
    if (ampm && ampm.toLowerCase() === 'pm') hours += 12;
    const at = new Date(
      Date.UTC(year, month - 1, day, hours, Number(mi), Number(se || 0)) - offset * 60_000,
    );
    const attachments: string[] = [];
    const kept: string[] = [];
    for (const piece of r.text.split('\n')) {
      const trimmed = piece.trim();
      const named = ATTACHED.map((pattern) => pattern.exec(trimmed)?.[1]).find(Boolean);
      if (named) attachments.push(named.trim());
      else if (OMITTED.test(trimmed)) attachments.push(trimmed.replace(/[<>]/g, ''));
      else kept.push(piece);
    }
    return { at, author: r.author, text: kept.join('\n').trim(), attachments };
  });
}

/** Reads a Telegram export (`result.json`): its messages, not its service lines. */
export function parseTelegramExport(source: string): ImportedMessage[] {
  const data = JSON.parse(source) as {
    messages?: {
      type?: string;
      date?: string;
      from?: string | null;
      text?: string | (string | { text?: string })[];
      photo?: string;
      file?: string;
    }[];
  };
  return (data.messages ?? [])
    .filter((m) => m.type === 'message' && m.date)
    .map((m) => ({
      at: new Date(m.date as string),
      author: (m.from ?? '').trim() || '?',
      text: (Array.isArray(m.text)
        ? m.text.map((part) => (typeof part === 'string' ? part : (part.text ?? ''))).join('')
        : (m.text ?? '')
      ).trim(),
      attachments: [m.photo, m.file]
        .filter((name): name is string => typeof name === 'string')
        .map((name) => name.split('/').pop() as string),
    }));
}

/**
 * Keeps imported messages in a thread (FR-012): dated as said, by the member the product
 * recognizes (by a number, by a name), else as the export names her; marked imported; kept once —
 * importing the same export again adds nothing.
 */
export async function importMessages(
  db: SqlExecutor,
  organizationId: string,
  input: {
    threadId: string;
    via: 'whatsapp' | 'telegram' | 'mail';
    messages: ImportedMessage[];
    authorOf: (name: string) => Pick<Member, 'kind' | 'id'> | null;
  },
): Promise<{ imported: number; skipped: number }> {
  const thread = await getThread(db, input.threadId);
  if (!thread) throw new ThreadError('not_found', 'No such thread here.');
  if (thread.state === 'closed') throw new ThreadError('closed', 'This thread is put away.');
  let imported = 0;
  let skipped = 0;
  for (const said of input.messages) {
    const known = input.authorOf(said.author);
    const author = known ?? { kind: 'contact' as const, id: `import:${said.author}`.slice(0, 100) };
    const files =
      said.attachments.length > 0
        ? `\n${said.attachments.map((name) => `📎 ${name}`).join('\n')}`
        : '';
    const text = `${said.text}${files}`.trim().slice(0, 20000);
    const key = createHash('sha256')
      .update(`${said.at.toISOString()}|${said.author}|${said.text}|${said.attachments.join(',')}`)
      .digest('hex');
    const message: Message = {
      id: newId('msg'),
      thread: thread.id,
      author: { kind: author.kind, id: author.id },
      text: text || '…',
      for: 'information',
      via: input.via,
      visibility: author.kind === 'contact' ? 'outside' : 'internal',
      at: said.at.toISOString(),
    };
    if (await insert(db, organizationId, message, key)) {
      imported += 1;
      if (author.kind !== 'contact') {
        await joinThread(db, organizationId, thread.id, author as Member, said.at);
      }
    } else skipped += 1;
  }
  return { imported, skipped };
}

/**
 * Two threads become one (FR-013): the messages of `from` are kept in `into` with their dates,
 * authors and words, each naming where it came from; `from` is put away, saying where it went. Its
 * holder merges it.
 */
export async function mergeThreads(
  db: SqlExecutor,
  organizationId: string,
  input: { from: string; into: string; by: Pick<Member, 'kind' | 'id'> },
  now = new Date(),
): Promise<{ moved: number }> {
  const from = await getThread(db, input.from);
  const into = await getThread(db, input.into);
  if (!from || !into || from.id === into.id) throw new ThreadError('not_found', 'Which threads?');
  if (from.holder.kind !== input.by.kind || from.holder.id !== input.by.id) {
    throw new ThreadError('not_the_author', 'Its holder merges a thread.');
  }
  if (into.state === 'closed') throw new ThreadError('closed', 'This thread is put away.');
  let moved = 0;
  for (const said of await messagesOf(db, from.id)) {
    if (said.movedTo || said.deleted) continue;
    const message: Message = {
      thread: into.id,
      author: said.author,
      text: said.text,
      ...(said.attachments ? { attachments: said.attachments } : {}),
      for: 'information',
      via: said.via,
      visibility: said.visibility ?? 'internal',
      ...(said.mentions ? { mentions: said.mentions } : {}),
      ...(said.references ? { references: said.references } : {}),
      moved_from: said.first,
      id: newId('msg'),
      at: said.at,
    };
    await insert(db, organizationId, message);
    await db.query(
      `insert into kete_message_moves (organization_id, message_id, thread_id, to_thread,
         moved_message_id, by_kind, by_id, at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [organizationId, said.first, from.id, into.id, message.id, input.by.kind, input.by.id, now],
    );
    moved += 1;
  }
  for (const member of (from.members ?? []).filter((m) => !m.until)) {
    await joinThread(db, organizationId, into.id, { kind: member.kind, id: member.id }, now);
  }
  await db.query(
    `update kete_threads set merged_into = $2, state = 'closed', closed_at = coalesce(closed_at, $3)
      where thread_id = $1`,
    [from.id, into.id, now],
  );
  return { moved };
}
