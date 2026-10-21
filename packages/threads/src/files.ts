import { createHash } from 'node:crypto';
import { newId } from '@kete/records';
import type { SqlExecutor } from '@kete/tenancy';
import { getThread, ThreadError, type Member } from './threads.js';

// Files in a thread (spec 139, FR-004; spec 140, FR-009): their name, type, size and fingerprint
// kept under the organization's row-level security; their bytes in the product's storage (a bucket,
// a disk) — or, without one, in the database as before. Sent again under the same name, a file is a
// new version and the earlier ones stay. A message names its files by their ids.

/** At most 100 MB a file in the product's storage: a video of a site, a long voice note. */
export const MAX_THREAD_FILE_BYTES = 100 * 1024 * 1024;
/** At most 10 MB a file kept in the database, when the product gives no storage. */
export const MAX_INLINE_FILE_BYTES = 10 * 1024 * 1024;

/** Where a product keeps the bytes: `@kete-africa/files`' storage fits it. */
export interface ThreadFileStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}

export interface ThreadFile {
  id: string;
  thread: string;
  name: string;
  media_type: string;
  bytes: number;
  sha256: string;
  by: { kind: Member['kind']; id: string };
  at: string;
  /** 1 for the first file of that name in the thread, then 2, 3… */
  version: number;
}

interface FileRow extends Record<string, unknown> {
  file_id: string;
  thread_id: string;
  name: string;
  media_type: string;
  bytes: number;
  sha256: string;
  by_kind: Member['kind'];
  by_id: string;
  at: Date;
  version: string;
}

const toFile = (row: FileRow): ThreadFile => ({
  id: row.file_id,
  thread: row.thread_id,
  name: row.name,
  media_type: row.media_type,
  bytes: Number(row.bytes),
  sha256: row.sha256,
  by: { kind: row.by_kind, id: row.by_id },
  at: new Date(row.at).toISOString(),
  version: Number(row.version),
});

const COLUMNS = `file_id, thread_id, name, media_type, bytes, sha256, by_kind, by_id, at,
  row_number() over (partition by thread_id, lower(name) order by at, file_id) as version`;

/** Keeps a file in a thread; the same name again is its next version. */
export async function saveThreadFile(
  db: SqlExecutor,
  organizationId: string,
  input: {
    threadId: string;
    name: string;
    mediaType: string;
    content: Uint8Array;
    by: Pick<Member, 'kind' | 'id'>;
  },
  now = new Date(),
  options: { store?: ThreadFileStore } = {},
): Promise<ThreadFile> {
  const thread = await getThread(db, input.threadId);
  if (!thread) throw new ThreadError('not_found', 'No such thread here.');
  if (thread.state === 'closed') throw new ThreadError('closed', 'This thread is put away.');
  const most = options.store ? MAX_THREAD_FILE_BYTES : MAX_INLINE_FILE_BYTES;
  if (input.content.byteLength === 0 || input.content.byteLength > most) {
    throw new ThreadError('file_too_large', `A file of ${most / 1024 / 1024} MB at most.`);
  }
  const name = input.name.trim().replace(/[\\/]/g, '_').slice(0, 200) || 'fichier';
  const fileId = newId('fil');
  const mediaType = (input.mediaType || 'application/octet-stream').slice(0, 100);
  const key = options.store ? `threads/${organizationId}/${thread.id}/${fileId}` : null;
  if (options.store && key) await options.store.put(key, input.content, mediaType);
  await db.query(
    `insert into kete_thread_files (file_id, organization_id, thread_id, name, media_type, bytes,
       sha256, content, storage_key, by_kind, by_id, at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      fileId,
      organizationId,
      thread.id,
      name,
      mediaType,
      input.content.byteLength,
      createHash('sha256').update(input.content).digest('hex'),
      key ? null : Buffer.from(input.content),
      key,
      input.by.kind,
      input.by.id,
      now,
    ],
  );
  const saved = (await filesOf(db, thread.id)).find((f) => f.id === fileId);
  return saved as ThreadFile;
}

/** A thread's files, every version, the latest first. */
export async function filesOf(db: SqlExecutor, threadId: string): Promise<ThreadFile[]> {
  const { rows } = await db.query<FileRow>(
    `select * from (select ${COLUMNS} from kete_thread_files where thread_id = $1) f
      order by at desc, file_id desc`,
    [threadId],
  );
  return rows.map(toFile);
}

/** A file and its bytes, for a reader the product already allowed; from its storage if kept there. */
export async function threadFile(
  db: SqlExecutor,
  fileId: string,
  options: { store?: ThreadFileStore } = {},
): Promise<(ThreadFile & { content: Uint8Array }) | null> {
  const { rows } = await db.query<FileRow & { content: Buffer | null; storage_key: string | null }>(
    `select f.*, c.content, c.storage_key from (select ${COLUMNS} from kete_thread_files
                                  where thread_id = (select thread_id from kete_thread_files
                                                      where file_id = $1)) f
       join kete_thread_files c on c.file_id = f.file_id
      where f.file_id = $1`,
    [fileId],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.content) return { ...toFile(row), content: new Uint8Array(row.content) };
  const stored = row.storage_key && options.store ? await options.store.get(row.storage_key) : null;
  return stored ? { ...toFile(row), content: stored } : null;
}
