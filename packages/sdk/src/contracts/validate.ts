import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { ErrorObject } from 'ajv';
import { schemas } from './schemas.gen.js';

// ajv-formats ships CommonJS; its default export is the plugin function.
const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => Ajv2020;

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
for (const schema of Object.values(schemas)) ajv.addSchema(schema as object);

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function toResult(valid: boolean, errors: ErrorObject[] | null | undefined): ValidationResult {
  return {
    ok: valid,
    errors: (errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? 'is invalid'}`),
  };
}

function validator(id: string): (value: unknown) => ValidationResult {
  const fn = ajv.getSchema(id);
  if (!fn) throw new Error(`Unknown contract: ${id}`);
  return (value) => toResult(fn(value) as boolean, fn.errors);
}

const base = 'https://kete.africa/contracts/';
export const validateEvent = validator(`${base}event.v1.schema.json`);
export const validateCapability = validator(`${base}capability.v1.schema.json`);
export const validateDataset = validator(`${base}dataset.v1.schema.json`);
export const validateManifest = validator(`${base}manifest.v1.schema.json`);
export const validateHealthReport = validator(`${base}health.v1.schema.json`);
/** A fact of money an app says to its center (doctrine D-049). */
export const validateMoneyFact = validator(`${base}money-fact.v1.schema.json`);
/** Something that will happen at a time, said to the center's Planifier (doctrine D-050). */
export const validateDatedFact = validator(`${base}dated-fact.v1.schema.json`);
/** A figure an app declares, read under the reader's rights (doctrine D-052). */
export const validateMetric = validator(`${base}metric.v1.schema.json`);
/** A figure read for a reader, under her rights (doctrine D-052). */
export const validateMetricReading = validator(`${base}metric-reading.v1.schema.json`);
/** Several proposals decided together by one gesture (doctrine D-051). */
export const validateProposalSet = validator(`${base}proposal-set.v1.schema.json`);
/** A skill, an agent or an app in its lifecycle (doctrine D-053). */
export const validateResource = validator(`${base}resource.v1.schema.json`);
/** What the use of a resource taught, gathered with consent (doctrine D-053). */
export const validateLesson = validator(`${base}lesson.v1.schema.json`);
/** A file an app keeps, with what it proves (spec 099). */
export const validateFileLink = validator(`${base}file-link.v1.schema.json`);
/** One event of a Kete Intelligence turn (spec 099). */
export const validateIntelligenceEvent = validator(`${base}intelligence-event.v1.schema.json`);
/** A thing in progress and who holds it (doctrine D-056, spec 111). */
export const validateHolding = validator(`${base}holding.v1.schema.json`);
/** A gesture about to be made, as the policy engine reads it (doctrine D-058, spec 112). */
export const validateGesture = validator(`${base}gesture.v1.schema.json`);
/** A rule of the organization, as a sentence and a Cedar rule (doctrine D-058, spec 112). */
export const validatePolicy = validator(`${base}policy.v1.schema.json`);
/** What the policy engine decided for a gesture (doctrine D-058, spec 112). */
export const validatePolicyDecision = validator(`${base}policy-decision.v1.schema.json`);
/** Where people talk about one thing (doctrine D-056, D-057, spec 113). */
export const validateThread = validator(`${base}thread.v1.schema.json`);
/** A kind of object an app or the center declares once (doctrine D-062, kete-core spec 142). */
export const validateObjectType = validator(`${base}object-type.v1.schema.json`);
/** One object said to the center's index: what finds, cites and rights it (kete-core spec 142). */
export const validateObject = validator(`${base}object.v1.schema.json`);
/** One thing said in a thread, never rewritten (doctrine D-057, spec 113). */
export const validateMessage = validator(`${base}message.v1.schema.json`);
/** Where the router tied something received from outside (doctrine D-056, spec 113). */
export const validateRouting = validator(`${base}routing.v1.schema.json`);
export const validateDeliveryRequest = validator(`${base}delivery-request.v1.schema.json`);
export const validateDeliveryResult = validator(`${base}delivery-result.v1.schema.json`);

/** Validates the `data` of a standard event against its definition in event-data.v1. */
export function validateEventData(definition: string, data: unknown): ValidationResult {
  return validator(`${base}event-data.v1.schema.json#/$defs/${definition}`)(data);
}
