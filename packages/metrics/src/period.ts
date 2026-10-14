// The periods a figure is read over (spec 103): the last 7, 30 or 90 days, the quarter or the year
// so far, or everything — each ending today, in the organization's days — and the period just
// before, of the same length, when the reader compares.

export type Period = '7d' | '30d' | '90d' | 'quarter' | 'year' | 'all';

export const PERIODS: readonly Period[] = ['7d', '30d', '90d', 'quarter', 'year', 'all'];

/** Two days, both included: `2026-10-08` to `2026-10-14`. */
export interface Range {
  from: string;
  to: string;
}

const DAY = 86_400_000;
const at = (day: string) => Date.parse(`${day}T00:00:00Z`);
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Whether a value is one of the periods. */
export function isPeriod(value: unknown): value is Period {
  return typeof value === 'string' && (PERIODS as readonly string[]).includes(value);
}

/** The days a period covers, ending `today`; null for everything. */
export function periodRange(period: Period, today: string): Range | null {
  const end = at(today);
  switch (period) {
    case 'all':
      return null;
    case '7d':
    case '30d':
    case '90d':
      return { from: dayOf(end - (Number.parseInt(period, 10) - 1) * DAY), to: today };
    case 'quarter': {
      const date = new Date(end);
      const first = Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3, 1);
      return { from: dayOf(first), to: today };
    }
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/** The days just before a range, as many as it has. */
export function previousRange(range: Range): Range {
  const length = (at(range.to) - at(range.from)) / DAY + 1;
  const to = at(range.from) - DAY;
  return { from: dayOf(to - (length - 1) * DAY), to: dayOf(to) };
}
