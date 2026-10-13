// The public entry point of @kete/sequences. Anything not exported here is internal.

export {
  formatNumber,
  lastNumber,
  nextNumber,
  SequenceError,
  sequencesMigrationSql,
  type SequencesMigrationOptions,
  type Series,
} from './sequences.js';
