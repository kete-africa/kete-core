import { isHuman, type Actor } from '@kete/commands';
import { newId } from '@kete/records';
import type { ProposalSet } from '@kete/sdk';
import { validateProposalSet } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';

// Proposal sets (kete-core spec 104; doctrine D-051): several things an agent proposes at once —
// the evening's tidying, a week's plan, what a document said — each ticked or not by the person,
// applied together by one gesture and undone together. Nothing in a set is true until applied; an
// irreversible gesture (level 4) is never applied in a batch: it asks its own confirmation.

export type ProposalItem = ProposalSet['items'][number];

/** What became of an item once she decided. */
export type ItemOutcome =
  | { key: string; state: 'applied'; result?: unknown }
  | { key: string; state: 'failed'; reason: string }
  | { key: string; state: 'needs_confirmation' }
  | { key: string; state: 'not_ticked' }
  | { key: string; state: 'undone' }
  | { key: string; state: 'undo_failed'; result?: unknown };

export type ProposalSetStatus = 'proposed' | 'applied' | 'dismissed' | 'undone';

export interface StoredProposalSet {
  set: ProposalSet;
  status: ProposalSetStatus;
  outcomes: ItemOutcome[];
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

export class ProposalSetError extends Error {
  constructor(
    readonly code: 'invalid' | 'not_found' | 'already_decided' | 'not_applied' | 'human_required',
    message: string,
  ) {
    super(message);
    this.name = 'ProposalSetError';
  }
}

interface Row extends Record<string, unknown> {
  proposal_set_id: string;
  origin: ProposalSet['origin'];
  for_person: string;
  items: ProposalSet['items'];
  status: ProposalSetStatus;
  outcomes: ItemOutcome[];
  decided_by: string | null;
  decided_at: Date | null;
  created_at: Date;
}

const toStored = (row: Row): StoredProposalSet => ({
  set: { id: row.proposal_set_id, origin: row.origin, for: row.for_person, items: row.items },
  status: row.status,
  outcomes: row.outcomes,
  decidedBy: row.decided_by,
  decidedAt: row.decided_at,
  createdAt: row.created_at,
});

const columns =
  'proposal_set_id, origin, for_person, items, status, outcomes, decided_by, decided_at, created_at';

/** A new set's identifier, in the contract's shape. */
export const newProposalSetId = () => newId('pps');

/** Keeps a set for its person to decide; one that breaks the contract is refused. */
export async function proposeSet(
  db: SqlExecutor,
  organizationId: string,
  set: Omit<ProposalSet, 'id'> & { id?: string },
): Promise<StoredProposalSet> {
  const full: ProposalSet = { ...set, id: set.id ?? newProposalSetId() };
  const checked = validateProposalSet(full);
  if (!checked.ok) throw new ProposalSetError('invalid', checked.errors.join('; '));
  if (new Set(full.items.map((item) => item.key)).size !== full.items.length) {
    throw new ProposalSetError('invalid', 'Two items share a key.');
  }
  const { rows } = await db.query<Row>(
    `insert into kete_proposal_sets (proposal_set_id, organization_id, origin, for_person, items)
     values ($1, $2, $3, $4, $5::jsonb)
     returning ${columns}`,
    [full.id, organizationId, full.origin, full.for, JSON.stringify(full.items)],
  );
  return toStored(rows[0] as Row);
}

export async function getProposalSet(
  db: SqlExecutor,
  id: string,
): Promise<StoredProposalSet | null> {
  const { rows } = await db.query<Row>(
    `select ${columns} from kete_proposal_sets where proposal_set_id = $1`,
    [id],
  );
  return rows[0] ? toStored(rows[0]) : null;
}

/** A person's sets, the newest first — those still to decide, by default. */
export async function proposalSetsFor(
  db: SqlExecutor,
  person: string,
  status: ProposalSetStatus = 'proposed',
): Promise<StoredProposalSet[]> {
  const { rows } = await db.query<Row>(
    `select ${columns} from kete_proposal_sets
      where for_person = $1 and status = $2
      order by created_at desc limit 50`,
    [person, status],
  );
  return rows.map(toStored);
}

async function decidable(db: SqlExecutor, id: string, by: Actor) {
  if (!isHuman(by)) throw new ProposalSetError('human_required', 'A person decides a set.');
  const stored = await getProposalSet(db, id);
  if (!stored) throw new ProposalSetError('not_found', `No proposal set ${id}.`);
  return stored;
}

async function save(
  db: SqlExecutor,
  id: string,
  status: ProposalSetStatus,
  outcomes: ItemOutcome[],
  by: Actor,
): Promise<StoredProposalSet> {
  const { rows } = await db.query<Row>(
    `update kete_proposal_sets
        set status = $2, outcomes = $3::jsonb, decided_by = $4, decided_at = now()
      where proposal_set_id = $1
      returning ${columns}`,
    [id, status, JSON.stringify(outcomes), by.id],
  );
  return toStored(rows[0] as Row);
}

/**
 * Applies the items she ticked, together, in their order: each through `apply` — the app's
 * capability, within her rights. A level 4 item is not applied: it waits for its own confirmation.
 * A failure does not stop the others; each says what became of it.
 */
export async function applySet(
  db: SqlExecutor,
  id: string,
  options: {
    by: Actor;
    ticked: readonly string[];
    apply: (
      item: ProposalItem,
    ) => Promise<{ ok: true; result?: unknown } | { ok: false; reason: string }>;
  },
): Promise<StoredProposalSet> {
  const stored = await decidable(db, id, options.by);
  if (stored.status !== 'proposed') {
    throw new ProposalSetError('already_decided', `The set ${id} is ${stored.status}.`);
  }
  const ticked = new Set(options.ticked);
  const outcomes: ItemOutcome[] = [];
  for (const item of stored.set.items) {
    if (!ticked.has(item.key)) {
      outcomes.push({ key: item.key, state: 'not_ticked' });
    } else if (item.level >= 4) {
      outcomes.push({ key: item.key, state: 'needs_confirmation' });
    } else {
      const done = await options.apply(item).catch((error: unknown) => ({
        ok: false as const,
        reason: error instanceof Error ? error.message : 'failed',
      }));
      outcomes.push(
        done.ok
          ? {
              key: item.key,
              state: 'applied',
              ...(done.result !== undefined ? { result: done.result } : {}),
            }
          : { key: item.key, state: 'failed', reason: done.reason },
      );
    }
  }
  return save(db, id, 'applied', outcomes, options.by);
}

/** She keeps none of it. */
export async function dismissSet(
  db: SqlExecutor,
  id: string,
  by: Actor,
): Promise<StoredProposalSet> {
  const stored = await decidable(db, id, by);
  if (stored.status !== 'proposed') {
    throw new ProposalSetError('already_decided', `The set ${id} is ${stored.status}.`);
  }
  return save(
    db,
    id,
    'dismissed',
    stored.set.items.map((item) => ({ key: item.key, state: 'not_ticked' })),
    by,
  );
}

/**
 * Undoes what was applied, together, the last first: each through `undo`, with what applying it
 * returned. What could not be undone says so.
 */
export async function undoSet(
  db: SqlExecutor,
  id: string,
  options: { by: Actor; undo: (item: ProposalItem, result: unknown) => Promise<boolean> },
): Promise<StoredProposalSet> {
  const stored = await decidable(db, id, options.by);
  if (stored.status !== 'applied') {
    throw new ProposalSetError('not_applied', `The set ${id} is ${stored.status}.`);
  }
  const outcomes = [...stored.outcomes];
  for (let index = outcomes.length - 1; index >= 0; index -= 1) {
    const outcome = outcomes[index];
    if (outcome?.state !== 'applied') continue;
    const item = stored.set.items.find((i) => i.key === outcome.key);
    const undone = item ? await options.undo(item, outcome.result).catch(() => false) : false;
    outcomes[index] = undone
      ? { key: outcome.key, state: 'undone' }
      : {
          key: outcome.key,
          state: 'undo_failed',
          ...(outcome.result !== undefined ? { result: outcome.result } : {}),
        };
  }
  return save(db, id, 'undone', outcomes, options.by);
}
