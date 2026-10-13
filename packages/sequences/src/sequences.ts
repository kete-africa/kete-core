import { organizationPolicySql, type SqlExecutor } from '@kete/tenancy';

// The numbers of an organization's documents (spec 095): quotes, invoices, purchase orders. A
// number is taken in the transaction that creates its document, so the two commit or roll back
// together: a series has no gap and no duplicate, which is what a tax office and an auditor ask of
// invoices. Each organization has its own series; a series may start again each period.

export interface SequencesMigrationOptions {
  /** Default `public`. */
  schema?: string;
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;
const checked = (name: string) => {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
};

/** The table of series with its row-level security. */
export function sequencesMigrationSql(options: SequencesMigrationOptions): string {
  const s = checked(options.schema ?? 'public');
  const app = checked(options.appRole);
  return `
create table ${s}.kete_sequences (
  organization_id text not null,
  -- What is numbered: \`invoice\`, \`quote\`, \`purchase_order\`.
  series text not null check (series ~ '^[a-z][a-z0-9_]{0,40}$'),
  -- The period a series starts again in — \`2026\`, \`2026-10\` — or empty for one that never does.
  period text not null default '' check (period ~ '^[0-9-]{0,10}$'),
  last bigint not null check (last >= 0),
  primary key (organization_id, series, period)
);
${organizationPolicySql({ schema: s, table: 'kete_sequences', appRole: app })}
grant select, insert, update on ${s}.kete_sequences to ${app};
revoke delete, truncate on ${s}.kete_sequences from ${app};
`;
}

/** What a series refuses. */
export class SequenceError extends Error {
  constructor(
    readonly code: 'invalid_series' | 'invalid_period' | 'invalid_pattern',
    message: string,
  ) {
    super(message);
    this.name = 'SequenceError';
  }
}

export interface Series {
  series: string;
  /** `2026` for a series that starts again each year; none for one that never does. */
  period?: string;
}

function keyOf(of: Series): [string, string] {
  if (!/^[a-z][a-z0-9_]{0,40}$/.test(of.series)) {
    throw new SequenceError('invalid_series', 'A series is named in lower case: `invoice`.');
  }
  const period = of.period ?? '';
  if (!/^[0-9-]{0,10}$/.test(period)) {
    throw new SequenceError('invalid_period', 'A period is `2026` or `2026-10`.');
  }
  return [of.series, period];
}

/**
 * The next number of a series, taken for good **when the caller's transaction commits**. Call it
 * in the transaction that writes the document: if that fails, the number is not consumed. Two
 * documents created at the same moment wait for each other and never share a number.
 */
export async function nextNumber(
  db: SqlExecutor,
  organizationId: string,
  of: Series,
): Promise<number> {
  const [series, period] = keyOf(of);
  const { rows } = await db.query<{ last: string }>(
    `insert into kete_sequences (organization_id, series, period, last)
     values ($1, $2, $3, 1)
     on conflict (organization_id, series, period) do update set last = kete_sequences.last + 1
     returning last`,
    [organizationId, series, period],
  );
  return Number(rows[0]?.last);
}

/** The last number given in a series; 0 when none was. It takes nothing. */
export async function lastNumber(db: SqlExecutor, of: Series): Promise<number> {
  const [series, period] = keyOf(of);
  const { rows } = await db.query<{ last: string }>(
    'select last from kete_sequences where series = $1 and period = $2',
    [series, period],
  );
  return Number(rows[0]?.last ?? 0);
}

/**
 * A document's reference from its number: `F-{YYYY}-{N:4}` gives `F-2026-0412`. `{YYYY}`, `{YY}`
 * and `{MM}` come from the date; `{N}` is the number, `{N:4}` padded to four digits.
 */
export function formatNumber(pattern: string, number: number, date: Date = new Date()): string {
  if (!/\{N(?::\d)?\}/.test(pattern) || !Number.isSafeInteger(number) || number < 1) {
    throw new SequenceError('invalid_pattern', 'A pattern holds {N} and a number from 1.');
  }
  const year = String(date.getUTCFullYear());
  return pattern
    .replaceAll('{YYYY}', year)
    .replaceAll('{YY}', year.slice(2))
    .replaceAll('{MM}', String(date.getUTCMonth() + 1).padStart(2, '0'))
    .replace(/\{N(?::(\d))?\}/g, (_, width?: string) =>
      String(number).padStart(Number(width ?? 1), '0'),
    );
}
