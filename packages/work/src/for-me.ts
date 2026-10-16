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

/** Overdue first, then due soonest, then without a due day; within each, the oldest first. */
export function byUrgency(a: Holding, b: Holding): number {
  if (a.due !== b.due) {
    if (a.due === null) return 1;
    if (b.due === null) return -1;
    return a.due < b.due ? -1 : 1;
  }
  const since = (h: Holding) => (h.waitingSince ?? h.since).getTime();
  return since(a) - since(b) || a.holdingId.localeCompare(b.holdingId);
}

/** One read for a person (FR-005): her open holdings and those waiting on her. */
export async function forMe(db: SqlExecutor, personId: string): Promise<ForMe> {
  const { rows } = await db.query<HoldingRow>(
    `select ${holdingColumns} from kete_holdings
      where state <> 'done'
        and ((holder_kind = 'person' and holder_id = $1)
          or (state = 'waiting' and waiting_on_kind = 'person' and waiting_on_id = $1))
      order by holding_id`,
    [personId],
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
