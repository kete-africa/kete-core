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
export const validateDeliveryRequest = validator(`${base}delivery-request.v1.schema.json`);
export const validateDeliveryResult = validator(`${base}delivery-result.v1.schema.json`);

/** Validates the `data` of a standard event against its definition in event-data.v1. */
export function validateEventData(definition: string, data: unknown): ValidationResult {
  return validator(`${base}event-data.v1.schema.json#/$defs/${definition}`)(data);
}
