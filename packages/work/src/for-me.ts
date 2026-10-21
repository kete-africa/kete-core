import type { SqlExecutor } from '@kete/tenancy';
import { holdingColumns, toHolding, type Holding, type HoldingRow } from './holdings.js';

// « Pour moi » (spec 111, FR-005; doctrine D-057): what a person must answer and what she holds,
// sorted by urgency, then age. What waits for her decision (cards) and what is to classify come
// from their own modules; the product sets them beside these.

export interface ForMe {
  /** Others' holdings waiting on her: she must answer. */
  toAnswer: Holding[];
  /** What she holds and must act on, waiting on someone or not. */
  held: Holding[];
  /** What she is told about, nothing more to do. */
  information: Holding[];
}

const rank: Record<Holding['priority'], number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/**
 * The most urgent first (spec 139), then overdue, then due soonest, then without a due day; within
 * each, the oldest first.
 */
export function byUrgency(a: Holding, b: Holding): number {
  if (a.priority !== b.priority) return rank[a.priority] - rank[b.priority];
  if (a.due !== b.due) {
    if (a.due === null) return 1;
    if (b.due === null) return -1;
    return a.due < b.due ? -1 : 1;
  }
  const since = (h: Holding) => (h.waitingSince ?? h.since).getTime();
  return since(a) - since(b) || a.holdingId.localeCompare(b.holdingId);
}

/**
 * One read for a person (FR-005): her open holdings and those waiting on her — what she put off
 * comes back at its time.
 */
export async function forMe(db: SqlExecutor, personId: string, now = new Date()): Promise<ForMe> {
  const { rows } = await db.query<HoldingRow>(
    `select ${holdingColumns} from kete_holdings
      where state <> 'done'
        and (snoozed_until is null or snoozed_until <= $2)
        and ((holder_kind = 'person' and holder_id = $1)
          or (state = 'waiting' and waiting_on_kind = 'person' and waiting_on_id = $1))
      order by holding_id`,
    [personId, now],
  );
  const all = rows.map(toHolding);
  const mine = (h: Holding) => h.holder.kind === 'person' && h.holder.id === personId;
  return {
    toAnswer: all
      .filter((h) => !mine(h) && h.waitingOn?.kind === 'person' && h.waitingOn.id === personId)
      .sort(byUrgency),
    held: all.filter((h) => mine(h) && h.purpose === 'action').sort(byUrgency),
    information: all.filter((h) => mine(h) && h.purpose === 'information').sort(byUrgency),
  };
}
