import { createHash } from 'node:crypto';
import { newId } from '@kete/records';
import type { SqlExecutor } from '@kete/tenancy';
import pgvector from 'pgvector';
import { z } from 'zod';
import { passagesOf, type Embedder } from './embedder.js';

// An organization's knowledge: sources, each readable by an audience, with their documents cut
// into passages; searched by words (Postgres full text) and by meaning (pgvector), the two lists
// fused by reciprocal rank; every hit carries what a citation needs.

/**
 * Who may read a source: keys the product chooses — `everyone`, `role:admin`, `unit:sav`,
 * `user:usr_x`… A reader passes her own keys; she reads a source when they meet.
 */
export const audienceKey = z.string().regex(/^[a-z]+(:[A-Za-z0-9_.-]{1,80})?$/);

export const sourceInput = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z
    .string()
    .regex(/^[a-z][a-z0-9_-]{1,30}$/)
    .default('upload'),
  audience: z.array(audienceKey).min(1).max(200).default(['everyone']),
  enabled: z.boolean().default(true),
});

export interface Source {
  sourceId: string;
  name: string;
  kind: string;
  enabled: boolean;
  audience: string[];
  documents: number;
  createdAt: string;
}

export interface KnowledgeDocument {
  documentId: string;
  sourceId: string;
  title: string;
  uri: string | null;
  pages: number | null;
  chunks: number;
  updatedAt: string;
}

export interface SearchHit {
  /** Higher is better (reciprocal rank fusion). */
  score: number;
  text: string;
  page: number | null;
  documentId: string;
  title: string;
  uri: string | null;
  sourceId: string;
  sourceName: string;
}

export class KnowledgeError extends Error {
  constructor(
    readonly code: 'not_found' | 'empty' | 'dimensions',
    message: string,
  ) {
    super(message);
    this.name = 'KnowledgeError';
  }
}

export async function createSource(
  db: SqlExecutor,
  organizationId: string,
  input: z.input<typeof sourceInput>,
): Promise<Source> {
  const v = sourceInput.parse(input);
  const sourceId = newId('ksrc');
  await db.query(
    `insert into kete_knowledge_sources (organization_id, source_id, name, kind, enabled, audience)
     values ($1, $2, $3, $4, $5, $6)`,
    [organizationId, sourceId, v.name, v.kind, v.enabled, v.audience],
  );
  return (await getSource(db, sourceId)) as Source;
}

/** Switches a source on or off, renames it, or changes who may read it. */
export async function updateSource(
  db: SqlExecutor,
  sourceId: string,
  change: { name?: string; enabled?: boolean; audience?: string[] },
): Promise<Source | null> {
  const v = sourceInput.partial().parse(change);
  await db.query(
    `update kete_knowledge_sources set
       name = coalesce($2, name), enabled = coalesce($3, enabled), audience = coalesce($4, audience)
     where source_id = $1`,
    [sourceId, v.name ?? null, v.enabled ?? null, v.audience ?? null],
  );
  return getSource(db, sourceId);
}

export async function removeSource(db: SqlExecutor, sourceId: string): Promise<boolean> {
  const { rows } = await db.query<{ source_id: string }>(
    `delete from kete_knowledge_sources where source_id = $1 returning source_id`,
    [sourceId],
  );
  return rows.length > 0;
}

type SourceRow = {
  source_id: string;
  name: string;
  kind: string;
  enabled: boolean;
  audience: string[];
  documents: number;
  created_at: Date;
};
const sourceOf = (r: SourceRow): Source => ({
  sourceId: r.source_id,
  name: r.name,
  kind: r.kind,
  enabled: r.enabled,
  audience: r.audience,
  documents: r.documents,
  createdAt: r.created_at.toISOString(),
});
const SOURCE_COLUMNS = `s.source_id, s.name, s.kind, s.enabled, s.audience, s.created_at,
  (select count(*)::int from kete_knowledge_documents d where d.source_id = s.source_id) as documents`;

export async function getSource(db: SqlExecutor, sourceId: string): Promise<Source | null> {
  const { rows } = await db.query<SourceRow>(
    `select ${SOURCE_COLUMNS} from kete_knowledge_sources s where s.source_id = $1`,
    [sourceId],
  );
  return rows[0] ? sourceOf(rows[0]) : null;
}

/** Every source, or only those a reader may read (her keys) when `audience` is given. */
export async function listSources(
  db: SqlExecutor,
  options: { audience?: string[] } = {},
): Promise<Source[]> {
  const { rows } = await db.query<SourceRow>(
    options.audience
      ? `select ${SOURCE_COLUMNS} from kete_knowledge_sources s
          where s.enabled and s.audience && $1::text[] order by s.name`
      : `select ${SOURCE_COLUMNS} from kete_knowledge_sources s order by s.name`,
    options.audience ? [options.audience] : [],
  );
  return rows.map(sourceOf);
}

/**
 * Indexes a document in a source: its passages, page by page, with their embeddings. The same
 * content indexed again changes nothing; a new version replaces the old passages.
 */
export async function indexDocument(
  db: SqlExecutor,
  input: {
    organizationId: string;
    sourceId: string;
    /** To replace a document; a new one gets its id. */
    documentId?: string;
    title: string;
    uri?: string | null;
    /** The document's text, one entry per page (a single entry when it has no pages). */
    pages: string[];
  },
  embedder: Embedder,
): Promise<{ documentId: string; chunks: number; unchanged: boolean }> {
  if (!(await getSource(db, input.sourceId))) {
    throw new KnowledgeError('not_found', `No source ${input.sourceId}.`);
  }
  const hash = createHash('sha256')
    .update(input.title)
    .update('\f')
    .update(input.pages.join('\f'))
    .digest('hex');
  const documentId = input.documentId ?? newId('kdoc');
  const { rows: existing } = await db.query<{ content_hash: string; chunks: number }>(
    `select content_hash, chunks from kete_knowledge_documents where document_id = $1`,
    [documentId],
  );
  if (existing[0]?.content_hash === hash) {
    return { documentId, chunks: existing[0].chunks, unchanged: true };
  }
  const passages = await passagesOf(input.pages);
  if (!passages.length) throw new KnowledgeError('empty', 'The document has no text to index.');
  const vectors: number[][] = [];
  for (let i = 0; i < passages.length; i += 64) {
    vectors.push(...(await embedder.embed(passages.slice(i, i + 64).map((p) => p.text))));
  }
  if (vectors.some((v) => v.length !== embedder.dimensions)) {
    throw new KnowledgeError('dimensions', 'The embeddings do not have the expected size.');
  }
  const pages = input.pages.length > 1 ? input.pages.length : null;
  await db.query(
    `insert into kete_knowledge_documents
       (organization_id, document_id, source_id, title, uri, content_hash, pages, chunks)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (organization_id, document_id) do update
       set title = $4, uri = $5, content_hash = $6, pages = $7, chunks = $8, updated_at = now()`,
    [
      input.organizationId,
      documentId,
      input.sourceId,
      input.title,
      input.uri ?? null,
      hash,
      pages,
      passages.length,
    ],
  );
  await db.query(`delete from kete_knowledge_chunks where document_id = $1`, [documentId]);
  for (let i = 0; i < passages.length; i += 100) {
    const batch = passages.slice(i, i + 100);
    const values: unknown[] = [];
    const rows = batch.map((p, j) => {
      const o = values.length;
      values.push(
        input.organizationId,
        documentId,
        i + j,
        p.page,
        p.text,
        pgvector.toSql(vectors[i + j] as number[]),
      );
      return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}::public.vector)`;
    });
    await db.query(
      `insert into kete_knowledge_chunks (organization_id, document_id, ordinal, page, text, embedding)
       values ${rows.join(', ')}`,
      values,
    );
  }
  return { documentId, chunks: passages.length, unchanged: false };
}

export async function listDocuments(
  db: SqlExecutor,
  sourceId: string,
): Promise<KnowledgeDocument[]> {
  const { rows } = await db.query<{
    document_id: string;
    source_id: string;
    title: string;
    uri: string | null;
    pages: number | null;
    chunks: number;
    updated_at: Date;
  }>(
    `select document_id, source_id, title, uri, pages, chunks, updated_at
       from kete_knowledge_documents where source_id = $1 order by title`,
    [sourceId],
  );
  return rows.map((r) => ({
    documentId: r.document_id,
    sourceId: r.source_id,
    title: r.title,
    uri: r.uri,
    pages: r.pages,
    chunks: r.chunks,
    updatedAt: r.updated_at.toISOString(),
  }));
}

export async function removeDocument(db: SqlExecutor, documentId: string): Promise<boolean> {
  const { rows } = await db.query<{ document_id: string }>(
    `delete from kete_knowledge_documents where document_id = $1 returning document_id`,
    [documentId],
  );
  return rows.length > 0;
}

/**
 * Searches what a reader may read: sources switched on whose audience meets her keys. Passages
 * found by words and by meaning are fused by reciprocal rank (k = 60), so that an exact term and
 * a paraphrase both count.
 */
export async function search(
  db: SqlExecutor,
  input: { query: string; audience: string[]; limit?: number },
  embedder: Embedder,
): Promise<SearchHit[]> {
  const query = input.query.trim();
  if (!query || !input.audience.length) return [];
  const [vector] = await embedder.embed([query]);
  if (!vector) return [];
  const { rows } = await db.query<{
    score: number;
    text: string;
    page: number | null;
    document_id: string;
    title: string;
    uri: string | null;
    source_id: string;
    source_name: string;
  }>(
    `with readable as (
       select c.chunk_id, c.embedding, c.words
         from kete_knowledge_chunks c
         join kete_knowledge_documents d on d.organization_id = c.organization_id and d.document_id = c.document_id
         join kete_knowledge_sources s on s.organization_id = d.organization_id and s.source_id = d.source_id
        where s.enabled and s.audience && $3::text[]
     ),
     by_meaning as (
       select chunk_id, row_number() over (order by distance) as rank
         from (select chunk_id, embedding operator(public.<=>) $1::public.vector as distance
                 from readable order by distance limit 40) m
     ),
     by_words as (
       select chunk_id, row_number() over (order by relevance desc) as rank
         from (select chunk_id, ts_rank_cd(words, websearch_to_tsquery('simple', $2)) as relevance
                 from readable where words @@ websearch_to_tsquery('simple', $2)
                order by relevance desc limit 40) w
     ),
     fused as (
       select chunk_id, sum(1.0 / (60 + rank))::float8 as score
         from (select * from by_meaning union all select * from by_words) both_lists
        group by chunk_id
     )
     select f.score, c.text, c.page, d.document_id, d.title, d.uri, s.source_id, s.name as source_name
       from fused f
       join kete_knowledge_chunks c on c.chunk_id = f.chunk_id
       join kete_knowledge_documents d on d.organization_id = c.organization_id and d.document_id = c.document_id
       join kete_knowledge_sources s on s.organization_id = d.organization_id and s.source_id = d.source_id
      order by f.score desc limit $4`,
    [pgvector.toSql(vector), query, input.audience, Math.min(Math.max(input.limit ?? 8, 1), 30)],
  );
  return rows.map((r) => ({
    score: r.score,
    text: r.text,
    page: r.page,
    documentId: r.document_id,
    title: r.title,
    uri: r.uri,
    sourceId: r.source_id,
    sourceName: r.source_name,
  }));
}
