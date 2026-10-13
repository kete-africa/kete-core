// The runtime's conversation tables as its version 1.76 creates them, frozen here: a migration
// that ran is never rewritten by a later version of the runtime. A test compares this text with
// what the installed runtime would create; when they differ, the difference is a new migration.

/** The tables this migration creates, each to be given its organization and its policy. */
export const RUNTIME_TABLES = [
  'mastra_threads',
  'mastra_messages',
  'mastra_resources',
  'mastra_observational_memory',
  'mastra_memory_run_fences',
] as const;

/** One statement per entry, with `SCHEMA` where the schema's name goes. */
export const RUNTIME_DDL: readonly string[] = [
  'CREATE TABLE IF NOT EXISTS "SCHEMA"."mastra_threads" ("id" TEXT PRIMARY KEY NOT NULL, "resourceId" TEXT NOT NULL, "title" TEXT NOT NULL, "metadata" JSONB, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "createdAtZ" TIMESTAMPTZ DEFAULT NOW(), "updatedAtZ" TIMESTAMPTZ DEFAULT NOW());',
  'CREATE TABLE IF NOT EXISTS "SCHEMA"."mastra_messages" ("id" TEXT PRIMARY KEY NOT NULL, "thread_id" TEXT NOT NULL, "content" TEXT NOT NULL, "role" TEXT NOT NULL, "type" TEXT NOT NULL, "createdAt" TIMESTAMP NOT NULL, "resourceId" TEXT, "createdAtZ" TIMESTAMPTZ DEFAULT NOW());',
  'CREATE TABLE IF NOT EXISTS "SCHEMA"."mastra_resources" ("id" TEXT PRIMARY KEY NOT NULL, "workingMemory" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "createdAtZ" TIMESTAMPTZ DEFAULT NOW(), "updatedAtZ" TIMESTAMPTZ DEFAULT NOW());',
  'CREATE TABLE IF NOT EXISTS "SCHEMA"."mastra_observational_memory" ("id" TEXT PRIMARY KEY NOT NULL, "lookupKey" TEXT NOT NULL, "scope" TEXT NOT NULL, "resourceId" TEXT, "threadId" TEXT, "activeObservations" TEXT NOT NULL, "activeObservationsPendingUpdate" TEXT, "originType" TEXT NOT NULL, "config" TEXT NOT NULL, "generationCount" INTEGER NOT NULL, "lastObservedAt" TIMESTAMP, "lastReflectionAt" TIMESTAMP, "pendingMessageTokens" INTEGER NOT NULL, "totalTokensObserved" INTEGER NOT NULL, "observationTokenCount" INTEGER NOT NULL, "isObserving" BOOLEAN NOT NULL, "isReflecting" BOOLEAN NOT NULL, "observedMessageIds" JSONB, "observedTimezone" TEXT, "bufferedObservations" TEXT, "bufferedObservationTokens" INTEGER, "bufferedMessageIds" JSONB, "bufferedReflection" TEXT, "bufferedReflectionTokens" INTEGER, "bufferedReflectionInputTokens" INTEGER, "reflectedObservationLineCount" INTEGER, "bufferedObservationChunks" JSONB, "isBufferingObservation" BOOLEAN NOT NULL, "isBufferingReflection" BOOLEAN NOT NULL, "lastBufferedAtTokens" INTEGER NOT NULL, "lastBufferedAtTime" TIMESTAMP, "metadata" JSONB, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "lastObservedAtZ" TIMESTAMPTZ DEFAULT NOW(), "lastReflectionAtZ" TIMESTAMPTZ DEFAULT NOW(), "lastBufferedAtTimeZ" TIMESTAMPTZ DEFAULT NOW(), "createdAtZ" TIMESTAMPTZ DEFAULT NOW(), "updatedAtZ" TIMESTAMPTZ DEFAULT NOW());',
  'CREATE INDEX IF NOT EXISTS "SCHEMA_idx_om_lookup_key" ON "SCHEMA"."mastra_observational_memory" ("lookupKey");',
  'CREATE INDEX IF NOT EXISTS "SCHEMA_mastra_threads_resourceid_createdat_idx" ON "SCHEMA"."mastra_threads" ("resourceId", "createdAt" DESC);',
  'CREATE INDEX IF NOT EXISTS "SCHEMA_mastra_messages_thread_id_createdat_idx" ON "SCHEMA"."mastra_messages" ("thread_id", "createdAt" DESC);',
  'CREATE TABLE IF NOT EXISTS "SCHEMA"."mastra_memory_run_fences" ("runId" TEXT PRIMARY KEY NOT NULL, "generation" BIGINT NOT NULL, "ownerId" TEXT NOT NULL, "retiredAt" BIGINT);',
];

/** The runtime's tables and indexes, in a schema. */
export function runtimeTablesSql(schema: string): string {
  return RUNTIME_DDL.map((statement) => statement.replaceAll('SCHEMA', schema)).join('\n');
}
