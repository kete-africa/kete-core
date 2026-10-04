import { OfficeParser } from 'officeparser';

// Tables from spreadsheets (spec 053): a workbook (Excel, OpenDocument) or a CSV read through
// officeparser, cell by cell, then typed — numbers in French or English notation, dates — so that
// a team's table becomes rows a product can store, query and chart.

export interface Sheet {
  name: string;
  /** Each row's cells as text, padded to the widest row. */
  rows: string[][];
}

export type ColumnType = 'number' | 'date' | 'text';

export interface Table {
  sheet: string;
  columns: { name: string; type: ColumnType }[];
  /** One record per row: a number, a day (`YYYY-MM-DD`), a text, or null when empty. */
  rows: Record<string, number | string | null>[];
}

export class SheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetError';
  }
}

const fileTypes = new Map<string, 'xlsx' | 'ods' | 'csv'>([
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['application/vnd.oasis.opendocument.spreadsheet', 'ods'],
  ['text/csv', 'csv'],
  ['text/tab-separated-values', 'csv'],
  ['application/vnd.ms-excel', 'csv'],
]);

/** Whether this kind of file holds tables read here. */
export const tabular = (contentType: string) => fileTypes.has(contentType);

/** The most frequent of `,`, `;` and tab in a CSV's first line. */
function delimiterOf(data: Uint8Array, contentType: string): string {
  if (contentType === 'text/tab-separated-values') return '\t';
  const head = new TextDecoder().decode(data.slice(0, 4096)).split(/\r?\n/)[0] ?? '';
  const counts = [',', ';', '\t'].map((d) => [d, head.split(d).length - 1] as const);
  return counts.sort((a, b) => b[1] - a[1])[0]?.[0] ?? ',';
}

type Node = {
  type: string;
  text?: string;
  children?: Node[];
  metadata?: { sheetName?: unknown; col?: unknown };
};

/** The sheets of a workbook or a CSV, as grids of text. */
export async function readSheets(contentType: string, data: Uint8Array): Promise<Sheet[]> {
  const fileType = fileTypes.get(contentType);
  if (!fileType) throw new SheetError(`Not a table: ${contentType}`);
  let ast;
  try {
    ast = await OfficeParser.parseOffice(new Uint8Array(data), {
      fileType,
      ignoreComments: true,
      ...(fileType === 'csv' ? { csvDelimiter: delimiterOf(data, contentType) } : {}),
    } as never);
  } catch (error) {
    throw new SheetError((error as Error).message);
  }
  return (ast.content as Node[])
    .filter((node) => node.type === 'sheet')
    .map((sheet, index) => {
      const rows = (sheet.children ?? [])
        .filter((row) => row.type === 'row')
        .map((row) => {
          const cells: string[] = [];
          for (const cell of row.children ?? []) {
            if (cell.type !== 'cell') continue;
            const col = typeof cell.metadata?.col === 'number' ? cell.metadata.col : cells.length;
            cells[col] = (cell.text ?? '').trim();
          }
          return Array.from(cells, (c) => c ?? '');
        });
      const width = Math.max(0, ...rows.map((r) => r.length));
      const name = sheet.metadata?.sheetName;
      return {
        name: typeof name === 'string' && name ? name : `Sheet${index + 1}`,
        rows: rows.map((r) => [...r, ...Array<string>(width - r.length).fill('')]),
      };
    });
}

/** Spaces, including the no-break ones spreadsheets put between thousands. */
const SPACES = new RegExp(`[${String.raw`\s`}${String.fromCharCode(0xa0, 0x202f)}]`, 'g');

/** A number in English (`1,200.5`) or French (`1 200,5`) notation, or null. */
export function numberOf(text: string): number | null {
  const t = text.replace(SPACES, '').replace(/[€$%]|FCFA|XOF/gi, '');
  if (!t || !/^[+-]?[\d.,]+$/.test(t)) return null;
  let normalized = t;
  const comma = t.lastIndexOf(',');
  const dot = t.lastIndexOf('.');
  if (comma > -1 && dot > -1) {
    normalized = comma > dot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (comma > -1) {
    // `1,200` and `12,345,678` group thousands; otherwise the comma is the French decimal mark.
    normalized = /^[+-]?\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  } else if (/^[+-]?\d{1,3}(\.\d{3}){2,}$/.test(t)) {
    // `1.200.000`: dots grouping thousands, as French or German writers may.
    normalized = t.replace(/\./g, '');
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** A day (`YYYY-MM-DD`) from `2026-11-15`, `15/11/2026` or `15-11-2026`, or null. */
export function dayOf(text: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(text);
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  const [y, m, d] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : fr
      ? [Number(fr[3]), Number(fr[2]), Number(fr[1])]
      : [0, 0, 0];
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return date.toISOString().slice(0, 10);
}

/** Header names made unique and non-empty (`Colonne 3`, `Montant (2)`). */
function headersOf(cells: string[]): string[] {
  const seen = new Map<string, number>();
  return cells.map((cell, i) => {
    const base = cell.replace(/\s+/g, ' ').trim().slice(0, 80) || `Colonne ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

/**
 * A sheet as a table: its first non-empty row names the columns; a column whose filled cells are
 * all numbers is a number, all days a date, otherwise text.
 */
export async function readTable(
  contentType: string,
  data: Uint8Array,
  options: { sheet?: string; maxRows?: number } = {},
): Promise<Table> {
  const sheets = await readSheets(contentType, data);
  const sheet = options.sheet ? sheets.find((s) => s.name === options.sheet) : sheets[0];
  if (!sheet) throw new SheetError('No such sheet.');
  const filled = sheet.rows.filter((r) => r.some((c) => c !== ''));
  const [header, ...body] = filled;
  if (!header) throw new SheetError('An empty sheet.');
  const names = headersOf(header);
  const limited = body.slice(0, options.maxRows ?? 100_000);
  const columns = names.map((name, i) => {
    const values = limited.map((r) => r[i] ?? '').filter((v) => v !== '');
    const type: ColumnType =
      values.length > 0 && values.every((v) => numberOf(v) !== null)
        ? 'number'
        : values.length > 0 && values.every((v) => dayOf(v) !== null)
          ? 'date'
          : 'text';
    return { name, type };
  });
  return {
    sheet: sheet.name,
    columns,
    rows: limited.map((r) =>
      Object.fromEntries(
        columns.map((c, i) => {
          const raw = r[i] ?? '';
          if (raw === '') return [c.name, null];
          return [
            c.name,
            c.type === 'number' ? numberOf(raw) : c.type === 'date' ? dayOf(raw) : raw,
          ];
        }),
      ),
    ),
  };
}
