// What a tool's result carries for the generic views (doctrine D-037). A capability returns one of
// these as its output, and names the matching view (`ui://kete/table`…); a draft carries its
// review on its own (`ui://kete/review`).

/** The generic views, as MCP Apps resources. */
export const VIEWS = {
  review: 'ui://kete/review',
  form: 'ui://kete/form',
  table: 'ui://kete/table',
  detail: 'ui://kete/detail',
} as const;

export type ViewKind = keyof typeof VIEWS;

export interface TableColumn {
  key: string;
  label: string;
  /** Numbers align right, in tabular figures. */
  align?: 'start' | 'end';
}

export interface TableContent {
  view: 'table';
  title: string;
  columns: TableColumn[];
  rows: Record<string, string | number | null>[];
  /** Said when there is no row. */
  empty?: string;
}

export interface DetailContent {
  view: 'detail';
  title: string;
  fields: { label: string; value: string | number | null }[];
}

export interface FormContent {
  view: 'form';
  title: string;
  /** The JSON Schema of the values: titles, types, required fields, choices. */
  schema: Record<string, unknown>;
  values?: Record<string, unknown>;
  /** The tool the form calls with its values; it must be visible to views (MCP Apps). */
  submit: { tool: string; label: string; arguments?: Record<string, unknown> };
}

export type ViewContent = TableContent | DetailContent | FormContent;

/** A table for a copilot: what a list capability returns with `view: VIEWS.table`. */
export function tableView(content: Omit<TableContent, 'view'>): TableContent {
  return { view: 'table', ...content };
}

/** One record, field by field: what a read capability returns with `view: VIEWS.detail`. */
export function detailView(content: Omit<DetailContent, 'view'>): DetailContent {
  return { view: 'detail', ...content };
}

/** A form drawn from a schema, which calls a tool with its values (`view: VIEWS.form`). */
export function formView(content: Omit<FormContent, 'view'>): FormContent {
  return { view: 'form', ...content };
}
