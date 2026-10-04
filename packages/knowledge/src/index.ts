// The public entry point of @kete/knowledge. Anything not exported here is internal.
export { aiEmbedder, passagesOf, type Embedder, type Passage } from './embedder.js';
export {
  audienceKey,
  createSource,
  getSource,
  indexDocument,
  KnowledgeError,
  listDocuments,
  listSources,
  removeDocument,
  removeSource,
  search,
  sourceInput,
  updateSource,
  type KnowledgeDocument,
  type SearchHit,
  type Source,
} from './knowledge.js';
export { knowledgeMigrationSql, type KnowledgeMigrationOptions } from './migration.js';
