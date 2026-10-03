// The public entry point of @kete/sdk. Anything not exported here is internal.

export type {
  AccountActivated,
  AccountClosed,
  AccountCreated,
  Capability,
  Dataset,
  DeliveryRequest,
  DeliveryResult,
  HealthReport,
  KeteEvent,
  Manifest,
  MetricsDaily,
  PaymentFailed,
  PaymentSucceeded,
  SubscriptionRenewalDue,
} from './contracts/types.gen.js';
export {
  validateCapability,
  validateDataset,
  validateDeliveryRequest,
  validateDeliveryResult,
  validateEvent,
  validateHealthReport,
  validateManifest,
  type ValidationResult,
} from './contracts/validate.js';

export {
  createEvent,
  InvalidEventError,
  MAX_EVENT_BYTES,
  type EventData,
} from './events/create.js';
export { createEmitter, type EmitInput, type Emitter } from './events/emitter.js';
export { newEventId, uuidv7 } from './events/ids.js';
export {
  isStandardEventType,
  standardEventTypes,
  type StandardEventDataMap,
  type StandardEventType,
} from './events/standard.js';

export { outboxMigrationSql, type OutboxMigrationOptions } from './outbox/migration.js';
export { recordEvent } from './outbox/record.js';
export {
  backoffSeconds,
  createOutboxRelay,
  MAX_BATCH_BYTES,
  MAX_BATCH_EVENTS,
  type FlushReport,
  type OutboxRelay,
  type RelayOptions,
} from './outbox/relay.js';
export { setOrganization, type SqlExecutor } from './outbox/sql.js';

export { httpTransport, TransientDeliveryError, type Transport } from './delivery/transport.js';

export {
  DEFAULT_TOLERANCE_SECONDS,
  PRODUCT_HEADER,
  SIGNATURE_HEADER,
  sign,
  verify,
  type KeyRing,
  type SigningKey,
  type VerificationFailure,
} from './signing/signature.js';

export {
  deliveryHandler,
  memoryDedupeStore,
  postgresDedupeStore,
  receivedEventsMigrationSql,
  receiveDelivery,
  type DedupeStore,
  type ReceiveOptions,
  type ReceiveOutcome,
} from './receiver/receive.js';

export {
  buildHealthReport,
  healthHandler,
  outboxBacklog,
  type DependencyCheck,
  type HealthOptions,
} from './health/health.js';

export {
  InvalidManifestError,
  loadManifest,
  manifestHandler,
  parseManifest,
} from './manifest/manifest.js';
