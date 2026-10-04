import { organizationPolicySql } from '@kete/tenancy';

export interface KnowledgeMigrationOptions {
  /** Default `public`. */
  schema?: string;
  appRole: string;
  /** The embedding model's dimensions (1536 for most current models). */
  dimensions?: number;
}

const identifier = /^[a-z_][a-z0-9_]*$/;

function checkIdentifier(name: string): string {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
}

/**
 * The knowledge tables, each with its row-level security in the same migration (constitution):
 * sources (who may read them, whether they are on), documents, and their passages — their words
 * for full-text search and their embedding for search by meaning. pgvector lives in `public`, so
 * the tables work whatever the schema they are in.
 */
export function knowledgeMigrationSql(options: KnowledgeMigrationOptions): string {
  const s = checkIdentifier(options.schema ?? 'public');
  const app = checkIdentifier(options.appRole);
  const dimensions = options.dimensions ?? 1536;
  if (!Number.isInteger(dimensions) || dimensions < 2 || dimensions > 4000) {
    throw new Error(`Invalid embedding dimensions: ${dimensions}`);
  }
  const policy = (table: string) => organizationPolicySql({ schema: s, table, appRole: app });
  return `
create extension if not exists vector with schema public;

create table ${s}.kete_knowledge_sources (
  organization_id text not null,
  source_id text not null,
  name text not null check (length(name) between 1 and 200),
  kind text not null default 'upload' check (kind ~ '^[a-z][a-z0-9_-]{1,30}$'),
  enabled boolean not null default true,
  audience text[] not null default '{everyone}' check (cardinality(audience) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (organization_id, source_id)
);
${policy('kete_knowledge_sources')}
grant select, insert, update, delete on ${s}.kete_knowledge_sources to ${app};

create table ${s}.kete_knowledge_documents (
  organization_id text not null,
  document_id text not null,
  source_id text not null,
  title text not null check (length(title) between 1 and 300),
  uri text,
  content_hash text not null,
  pages integer,
  chunks integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organization_id, document_id),
  foreign key (organization_id, source_id)
    references ${s}.kete_knowledge_sources (organization_id, source_id) on delete cascade
);
create index kete_knowledge_documents_source on ${s}.kete_knowledge_documents (organization_id, source_id);
${policy('kete_knowledge_documents')}
grant select, insert, update, delete on ${s}.kete_knowledge_documents to ${app};

create table ${s}.kete_knowledge_chunks (
  chunk_id bigint generated always as identity primary key,
  organization_id text not null,
  document_id text not null,
  ordinal integer not null,
  page integer,
  text text not null,
  words tsvector generated always as (to_tsvector('simple', text)) stored,
  embedding public.vector(${dimensions}) not null,
  foreign key (organization_id, document_id)
    references ${s}.kete_knowledge_documents (organization_id, document_id) on delete cascade
);
create index kete_knowledge_chunks_document on ${s}.kete_knowledge_chunks (organization_id, document_id);
create index kete_knowledge_chunks_words on ${s}.kete_knowledge_chunks using gin (words);
create index kete_knowledge_chunks_meaning on ${s}.kete_knowledge_chunks
  using hnsw (embedding public.vector_cosine_ops);
${policy('kete_knowledge_chunks')}
grant select, insert, delete on ${s}.kete_knowledge_chunks to ${app};
`;
}
