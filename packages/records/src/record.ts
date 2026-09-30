import { z } from 'zod';
import { describeFields, type FieldDescriptor } from './fields.js';

/**
 * A record, described once (CONCEPTION A.1): from this single schema come the form, the server
 * validation, the MCP tool's input, the API, and the drafts.
 */
export interface RecordDefinition<Schema extends z.ZodObject> {
  /** The record's type, e.g. `deposit`. */
  type: string;
  /** The prefix of its identifiers, e.g. `dep` (CONCEPTION 11). */
  prefix: string;
  schema: Schema;
  /** A short sentence a person or an agent reads: « Dépôt de 3 chemises pour Ama, prêt vendredi ». */
  summarize(record: z.output<Schema>): string;
}

export interface DefinedRecord<Schema extends z.ZodObject> extends RecordDefinition<Schema> {
  /** Every field with its metadata. */
  fields: FieldDescriptor[];
  /** The record as JSON Schema: for MCP tools, OpenAPI and other languages. */
  jsonSchema(): Record<string, unknown>;
}

const typePattern = /^[a-z][a-z0-9_]*$/;

export function defineRecord<Schema extends z.ZodObject>(
  definition: RecordDefinition<Schema>,
): DefinedRecord<Schema> {
  if (!typePattern.test(definition.type)) {
    throw new TypeError(`A record type is written in snake case: ${definition.type}`);
  }
  if (!/^[a-z]{2,5}$/.test(definition.prefix)) {
    throw new TypeError(`A prefix has 2 to 5 lowercase letters: ${definition.prefix}`);
  }
  return {
    ...definition,
    fields: describeFields(definition.schema),
    jsonSchema: () => z.toJSONSchema(definition.schema) as Record<string, unknown>,
  };
}
