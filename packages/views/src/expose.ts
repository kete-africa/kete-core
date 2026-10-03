import { defineCapability, type CapabilityDefinition } from '@kete/capabilities';
import type { SqlExecutor } from '@kete/tenancy';
import { z } from 'zod';
import { detailView, tableView, VIEWS } from './contract.js';

// A record type, exposed to agents in two read capabilities (spec 045): `{type}_list` (a table a
// copilot shows, searchable) and `{type}_get` (one record, field by field). Level 1, under the
// record's read permission: an app's data enters the system with no integration code. Words come
// from the app's catalog, read when the capability runs (the person's language).

type Words = () => string;
type Cell = string | number | null;

export interface ExposedColumn<Item> {
  key: string;
  label: Words;
  align?: 'start' | 'end';
  value(item: Item): Cell;
}

export interface ExposeRecordOptions<Item> {
  /** The record type, snake case: `ticket` gives `ticket_list` and `ticket_get`. */
  type: string;
  /** What the records are, for a model: « the open and recent tickets of the support queues ». */
  description: string;
  permission: string;
  /** The list's title and what it says when empty. */
  title: Words;
  empty: Words;
  columns: ExposedColumn<Item>[];
  /** The records matching a free-text query (or all), most relevant first, at most `limit`. */
  list(db: SqlExecutor, query: { text?: string | undefined; limit: number }): Promise<Item[]>;
  get(db: SqlExecutor, id: string): Promise<Item | null>;
  /** The record's title in a detail view. */
  label(item: Item): string;
}

export function exposeRecord<Item>(options: ExposeRecordOptions<Item>): CapabilityDefinition[] {
  if (!/^[a-z][a-z0-9_]{0,55}$/.test(options.type)) {
    throw new Error(`A record type is written in snake case: ${options.type}`);
  }
  const row = (item: Item) =>
    Object.fromEntries(options.columns.map((column) => [column.key, column.value(item)]));
  const list = defineCapability({
    name: `${options.type}_list`,
    description: `Lists ${options.description}, as a table; give \`text\` to search.`,
    permission: options.permission,
    autonomy: 1,
    input: z.object({
      text: z.string().trim().min(1).max(200).optional(),
      limit: z.number().int().min(1).max(100).default(50),
    }),
    view: VIEWS.table,
    async run(input, { db }) {
      const items = await options.list(db, { text: input.text, limit: input.limit });
      return tableView({
        title: options.title(),
        empty: options.empty(),
        columns: options.columns.map((column) => ({
          key: column.key,
          label: column.label(),
          ...(column.align ? { align: column.align } : {}),
        })),
        rows: items.map(row),
      });
    },
  });
  const get = defineCapability({
    name: `${options.type}_get`,
    description: `One of ${options.description}, field by field, by its identifier.`,
    permission: options.permission,
    autonomy: 1,
    input: z.object({ id: z.string().trim().min(1).max(80) }),
    view: VIEWS.detail,
    async run(input, { db }) {
      const item = await options.get(db, input.id);
      if (!item) return detailView({ title: options.empty(), fields: [] });
      return detailView({
        title: options.label(item),
        fields: options.columns.map((column) => ({
          label: column.label(),
          value: column.value(item),
        })),
      });
    },
  });
  return [list, get] as CapabilityDefinition[];
}
