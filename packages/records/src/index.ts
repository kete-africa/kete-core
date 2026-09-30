// The public entry point of @kete/records. Anything not exported here is internal.

export {
  describeFields,
  field,
  redactPersonal,
  type FieldDescriptor,
  type FieldMeta,
} from './fields.js';
export { isId, newId, prefixOf } from './ids.js';
export {
  assertTransition,
  canTransition,
  isEffective,
  recordStates,
  TransitionError,
  type RecordState,
} from './lifecycle.js';
export { addMoney, formatMoney, minorDigits, moneySchema, type Money } from './money.js';
export { defineRecord, type DefinedRecord, type RecordDefinition } from './record.js';
