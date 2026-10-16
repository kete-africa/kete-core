import type { SqlExecutor } from '@kete/tenancy';
import {
  holdingColumns,
  toHolding,
  type Holding,
  type HoldingRow,
  type WaitingOn,
} from './holdings.js';

// The figures of a fluid company (spec 111, FR-006), computed from the holdings, never by a model:
// the oldest wait, the waits over 48 hours and with whom.

const HOUR = 3_600_000;

export interface Fluidity {
  open: number;
  waiting: number;
  /** The holding that waits the longest, and for how many hours. */
  oldestWait: { holding: Holding; hours: number } | null;
  /** The waits over 48 hours, by whom they wait on, the most first. */
  over48h: { waitingOn: WaitingOn; count: number; oldestHours: number }[];
}

export async function fluidity(db: SqlExecutor, now = new Date()): Promise<Fluidity> {
  const { rows } = await db.query<HoldingRow>(
    `select ${holdingColumns} from kete_holdings where state <> 'done'`,
  );
  const open = rows.map(toHolding);
  const waiting = open.filter((h) => h.state === 'waiting' && h.waitingSince && h.waitingOn);
  const hours = (h: Holding) =>
    Math.floor((now.getTime() - (h.waitingSince as Date).getTime()) / HOUR);
  const oldest = [...waiting].sort((a, b) => hours(b) - hours(a))[0];
  const late = new Map<string, { waitingOn: WaitingOn; count: number; oldestHours: number }>();
  for (const holding of waiting) {
    const waited = hours(holding);
    if (waited < 48) continue;
    const on = holding.waitingOn as WaitingOn;
    const key = `${on.kind}:${on.id}`;
    const known = late.get(key) ?? { waitingOn: on, count: 0, oldestHours: 0 };
    late.set(key, {
      waitingOn: on,
      count: known.count + 1,
      oldestHours: Math.max(known.oldestHours, waited),
    });
  }
  return {
    open: open.length,
    waiting: waiting.length,
    oldestWait: oldest ? { holding: oldest, hours: hours(oldest) } : null,
    over48h: [...late.values()].sort((a, b) => b.count - a.count || b.oldestHours - a.oldestHours),
  };
}
