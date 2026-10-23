import { answerQuery, MAX_ROWS, QueryRefused } from '@kete/metrics';
import type { Dataset, DatasetAnswer } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { z } from 'zod';
import type { Classification } from './capability.js';
import type { Caller, CapabilityHost } from './registry.js';

// Data sets (spec 045): what a product exposes to people's dashboards, to its assistant and to
// other apps — rows of one shape, always read under the reader's rights, in her organization's
// transaction. Declared once; the manifest describes them (dataset.v1); the API serves them.

export interface DatasetQuery {
  /** Rows whose time field is on or after this day (YYYY-MM-DD). */
  from?: string;
  /** Rows whose time field is on or before this day. */
  to?: string;
  /** At most this many rows (default 500, at most 5000). */
  limit: number;
}

export interface DatasetDefinition<Row extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  /** The permission to read it: checked for the caller, as for a capability. */
  permission: string;
  /** One row's shape: its JSON Schema goes into the manifest. */
  row: Row;
  /** The field that dates a row; `from` and `to` filter on it. */
  time?: keyof z.output<Row> & string;
  measures?: (keyof z.output<Row> & string)[];
  dimensions?: (keyof z.output<Row> & string)[];
  /** How far its rows may travel (spec 049): `internal` by default. */
  classification?: Classification;
  /**
   * Which fields carry the center's four axes and the object a row is about (spec 144): a filter
   * « project = X » then applies to its rows, at home.
   */
  axes?: {
    project?: keyof z.output<Row> & string;
    party?: keyof z.output<Row> & string;
    unit?: keyof z.output<Row> & string;
    person?: keyof z.output<Row> & string;
    object?: { kind: string; field: keyof z.output<Row> & string };
  };
  /** The rows, in the caller's organization (RLS applies), filtered by the query. */
  rows(query: DatasetQuery, context: { db: SqlExecutor; caller: Caller }): Promise<z.output<Row>[]>;
}

const namePattern = /^[a-z][a-z0-9_]{0,62}$/;
const permissionPattern = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/;

/** Declares a data set; its shape is checked once, at start-up. */
export function defineDataset<Row extends z.ZodObject>(
  definition: DatasetDefinition<Row>,
): DatasetDefinition<Row> {
  if (!namePattern.test(definition.name)) {
    throw new Error(`A data set is named in snake case: ${definition.name}`);
  }
  if (!permissionPattern.test(definition.permission)) {
    throw new Error(`A permission reads « feature:verb »: ${definition.permission}`);
  }
  const fields = Object.keys(definition.row.shape);
  const axes = definition.axes ?? {};
  for (const field of [
    ...(definition.time ? [definition.time] : []),
    ...(definition.measures ?? []),
    ...(definition.dimensions ?? []),
    ...[axes.project, axes.party, axes.unit, axes.person, axes.object?.field].filter(
      (f): f is string => typeof f === 'string',
    ),
  ]) {
    if (!fields.includes(field)) {
      throw new Error(`${definition.name}: « ${field} » is not a field of its rows.`);
    }
  }
  return definition;
}

/** A data set as the manifest describes it (dataset.v1). */
export function describeDataset(definition: DatasetDefinition): Dataset {
  return {
    name: definition.name,
    description: definition.description,
    permission: definition.permission,
    row: z.toJSONSchema(definition.row) as Record<string, unknown>,
    ...(definition.time ? { time: definition.time } : {}),
    ...(definition.measures?.length ? { measures: definition.measures } : {}),
    ...(definition.dimensions?.length ? { dimensions: definition.dimensions } : {}),
    ...(definition.classification ? { classification: definition.classification } : {}),
    ...(definition.axes && Object.keys(definition.axes).length ? { axes: definition.axes } : {}),
  };
}

const day = /^\d{4}-\d{2}-\d{2}$/;

export type DatasetRead =
  | { status: 'done'; dataset: string; rows: unknown[]; truncated: boolean }
  | { status: 'refused'; reason: 'unknown_dataset' | 'not_allowed' | 'invalid_query' };

export type DatasetSummed =
  | ({ status: 'done' } & DatasetAnswer)
  | {
      status: 'refused';
      reason:
        'unknown_dataset' | 'not_allowed' | 'invalid_query' | 'unknown_field' | 'not_a_number';
      message?: string;
    };

export interface DatasetRegistry {
  /** The data sets this caller may read. */
  list(caller: Caller): Promise<Dataset[]>;
  /** Every data set, for the manifest. */
  describeAll(): Dataset[];
  read(
    caller: Caller,
    name: string,
    query: Partial<Record<'from' | 'to' | 'limit', string>>,
  ): Promise<DatasetRead>;
  /**
   * A question (dataset-query.v1) summed up here, under the caller's rights: only the answer
   * travels (spec 144, ADR 0015).
   */
  query(caller: Caller, name: string, question: unknown): Promise<DatasetSummed>;
}

/** The product's data sets, read with the same rights and transaction as its capabilities. */
export function createDatasetRegistry(
  definitions: readonly DatasetDefinition[],
  host: CapabilityHost,
): DatasetRegistry {
  const byName = new Map<string, DatasetDefinition>();
  for (const definition of definitions) {
    if (byName.has(definition.name)) throw new Error(`Duplicate data set: ${definition.name}`);
    byName.set(definition.name, definition);
  }
  return {
    async list(caller) {
      const allowed = await Promise.all(
        definitions.map(async (d) => ((await host.authorize(caller, d.permission)) ? d : null)),
      );
      return allowed.filter((d): d is DatasetDefinition => d !== null).map(describeDataset);
    },
    describeAll: () => definitions.map(describeDataset),
    async read(caller, name, raw) {
      const definition = byName.get(name);
      if (!definition) return { status: 'refused', reason: 'unknown_dataset' };
      if (!(await host.authorize(caller, definition.permission))) {
        return { status: 'refused', reason: 'not_allowed' };
      }
      const limit = raw.limit === undefined ? 500 : Number(raw.limit);
      if (
        (raw.from !== undefined && !day.test(raw.from)) ||
        (raw.to !== undefined && !day.test(raw.to)) ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 5000
      ) {
        return { status: 'refused', reason: 'invalid_query' };
      }
      const query: DatasetQuery = {
        limit,
        ...(raw.from ? { from: raw.from } : {}),
        ...(raw.to ? { to: raw.to } : {}),
      };
      // One more row than asked tells whether the answer was cut.
      const rows = await host.transaction(caller.organizationId, (db) =>
        definition.rows({ ...query, limit: limit + 1 }, { db, caller }),
      );
      return {
        status: 'done',
        dataset: name,
        rows: rows.slice(0, limit),
        truncated: rows.length > limit,
      };
    },
    async query(caller, name, question) {
      const definition = byName.get(name);
      if (!definition) return { status: 'refused', reason: 'unknown_dataset' };
      if (!(await host.authorize(caller, definition.permission))) {
        return { status: 'refused', reason: 'not_allowed' };
      }
      const asked = (question ?? {}) as { from?: unknown; to?: unknown };
      const period = {
        ...(typeof asked.from === 'string' && day.test(asked.from) ? { from: asked.from } : {}),
        ...(typeof asked.to === 'string' && day.test(asked.to) ? { to: asked.to } : {}),
      };
      try {
        const rows = await host.transaction(caller.organizationId, (db) =>
          definition.rows({ ...period, limit: MAX_ROWS + 1 }, { db, caller }),
        );
        const answer = answerQuery(
          describeDataset(definition),
          rows.slice(0, MAX_ROWS) as Record<string, unknown>[],
          question,
          { cut: rows.length > MAX_ROWS },
        );
        return { status: 'done', ...answer };
      } catch (error) {
        if (error instanceof QueryRefused) {
          return { status: 'refused', reason: error.code, message: error.message };
        }
        throw error;
      }
    },
  };
}
