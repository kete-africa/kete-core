// The public entry point of @kete/connections. Anything not exported here is internal.

export {
  finishOAuth,
  OAuthError,
  refreshOAuth,
  startOAuth,
  type OAuthProvider,
  type OAuthTokens,
} from './oauth.js';
export { createSealer, SealError, type Sealer } from './seal.js';
export {
  connect,
  ConnectionError,
  connectionHistory,
  connectionsMigrationSql,
  credentialOf,
  listConnections,
  recordCheck,
  revokeConnection,
  type Connection,
  type ConnectionsMigrationOptions,
  type Credential,
} from './store.js';
