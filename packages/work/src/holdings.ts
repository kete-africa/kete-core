import { newId } from '@kete/records';
import { validateHolding, type Holding as SaidHolding } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';

// A thing in progress and who holds it (contract holding.v1, spec 111, doctrine D-056). An app says
// it under its source; said again, it replaces what was said. It always has a holder.

export interface Holder {
  kind: 'person' | 'agent';
  id: string;
}

export interface WaitingOn {
  kind: 'person' | 'agent' | 'party';
  id: string;
}

export type HoldingState = 'held' | 'waiting' | 'done';

export interface Holding {
  holdingId: string;
  source: { app: string; kind: string; ref: string };
  object: { kind: string; id: string };
  what: string;
  holder: Holder;
  waitingOn: WaitingOn | null;
  /** Since when it waits on `waitingOn`. */
  waitingSince: Date | null;
  since: Date;
  /** The day it is due, in the organization's time (`2026-10-16`). */
  due: string | null;
  state: HoldingState;
  purpose: 'action' | 'information';
  /** Whose it was before the relay took it over: who may have it handed back. */
  takenOverFrom: Holder | null;
  lastNudgedAt: Date | null;
  doneAt: Date | null;
}

export type HoldingEventType =
  | 'holding.created'
  | 'holding.waiting'
  | 'holding.nudged'
  | 'holding.taken_over'
  | 'holding.handed_back'
  | 'holding.done';

export interface HoldingEvent {
  eventId: string;
  holdingId: string;
  type: HoldingEventType;
  data: Record<string, unknown>;
  at: Date;
}

export class HoldingError extends Error {
  constructor(
    readonly code: 'holder_required' | 'invalid_holding' | 'not_found' | 'not_taken_over',
    message: string,
    readonly issues?: string[],
  ) {
    super(message);
    this.name = 'HoldingError';
  }
}

export interface HoldingRow extends Record<string, unknown> {
  holding_id: string;
  source_app: string;
  source_kind: string;
  source_ref: string;
  object_kind: string;
  object_id: string;
  what: string;
  holder_kind: Holder['kind'];
  holder_id: string;
  waiting_on_kind: WaitingOn['kind'] | null;
  waiting_on_id: string | null;
  waiting_since: Date | null;
  since: Date;
  due: string | Date | null;
  state: HoldingState;
  purpose: 'action' | 'information';
  taken_over_from_kind: Holder['kind'] | null;
  taken_over_from_id: string | null;
  last_nudged_at: Date | null;
  done_at: Date | null;
}

export const holdingColumns = `holding_id, source_app, source_kind, source_ref, object_kind, object_id,
  what, holder_kind, holder_id, waiting_on_kind, waiting_on_id, waiting_since, since,
  to_char(due, 'YYYY-MM-DD') as due, state, purpose, taken_over_from_kind, taken_over_from_id,
  last_nudged_at, done_at`;

const date = (value: Date | null) => (value ? new Date(value) : null);

export function toHolding(row: HoldingRow): Holding {
  return {
    holdingId: row.holding_id,
    source: { app: row.source_app, kind: row.source_kind, ref: row.source_ref },
    object: { kind: row.object_kind, id: row.object_id },
    what: row.what,
    holder: { kind: row.holder_kind, id: row.holder_id },
    waitingOn:
      row.waiting_on_kind && row.waiting_on_id
        ? { kind: row.waiting_on_kind, id: row.waiting_on_id }
        : null,
    waitingSince: date(row.waiting_since),
    since: new Date(row.since),
    due: row.due === null ? null : String(row.due),
    state: row.state,
    purpose: row.purpose,
    takenOverFrom:
      row.taken_over_from_kind && row.taken_over_from_id
        ? { kind: row.taken_over_from_kind, id: row.taken_over_from_id }
        : null,
    lastNudgedAt: date(row.last_nudged_at),
    doneAt: date(row.done_at),
  };
}

/** Appends one event of a holding: its journal, never changed. */
export async function journal(
  db: SqlExecutor,
  organizationId: string,
  holdingId: string,
  type: HoldingEventType,
  data: Record<string, unknown> = {},
  at = new Date(),
): Promise<void> {
  await db.query(
    `insert into kete_holding_events (event_id, organization_id, holding_id, type, data, at)
     values ($1, $2, $3, $4, $5, $6)`,
    [newId('hev'), organizationId, holdingId, type, JSON.stringify(data), at],
  );
}

/** Checks a holding as an app says it; one without a holder is refused at the edge. */
function checkSaid(said: unknown): SaidHolding {
  const holder = (said as { holder?: { id?: unknown } } | null)?.holder;
  if (!holder || typeof holder.id !== 'string' || holder.id.length === 0) {
    throw new HoldingError('holder_required', 'A holding always has a holder.');
  }
  const checked = validateHolding(said);
  if (!checked.ok) {
    throw new HoldingError(
      'invalid_holding',
      'The holding does not fit holding.v1.',
      checked.errors,
    );
  }
  return said as SaidHolding;
}

const same = (a: { kind: string; id: string } | null, b: { kind: string; id: string } | null) =>
  a?.kind === b?.kind && a?.id === b?.id;

/**
 * Keeps a holding as an app says it (FR-001): new under its source, or replacing what was said.
 * Each change of hands, of wait or of state is journaled.
 */
export async function sayHolding(
  db: SqlExecutor,
  organizationId: string,
  said: unknown,
  now = new Date(),
): Promise<Holding> {
  const holding = checkSaid(said);
  const waitingOn = holding.state === 'done' ? null : (holding.waiting_on ?? null);
  const state = holding.state === 'waiting' && !waitingOn ? 'held' : holding.state;
  const { rows: before } = await db.query<HoldingRow>(
    `select ${holdingColumns} from kete_holdings
      where source_app = $1 and source_kind = $2 and source_ref = $3 for update`,
    [holding.source.app, holding.source.kind, holding.source.ref],
  );
  const previous = before[0] ? toHolding(before[0]) : null;
  const waitingSince =
    state !== 'waiting'
      ? null
      : previous?.state === 'waiting' && same(previous.waitingOn, waitingOn)
        ? previous.waitingSince
        : now;
  const values = [
    holding.object.kind,
    holding.object.id,
    holding.what,
    holding.holder.kind,
    holding.holder.id,
    waitingOn?.kind ?? null,
    waitingOn?.id ?? null,
    waitingSince,
    holding.due ?? null,
    state,
    holding.for ?? 'action',
    state === 'done' ? (previous?.doneAt ?? now) : null,
  ];
  let row: HoldingRow;
  if (!previous) {
    const { rows } = await db.query<HoldingRow>(
      `insert into kete_holdings (holding_id, organization_id, source_app, source_kind, source_ref,
         object_kind, object_id, what, holder_kind, holder_id, waiting_on_kind, waiting_on_id,
         waiting_since, due, state, purpose, done_at, since)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       returning ${holdingColumns}`,
      [
        newId('hld'),
        organizationId,
        holding.source.app,
        holding.source.kind,
        holding.source.ref,
        ...values,
        holding.since ? new Date(holding.since) : now,
      ],
    );
    row = rows[0] as HoldingRow;
  } else {
    const { rows } = await db.query<HoldingRow>(
      `update kete_holdings
          set object_kind = $2, object_id = $3, what = $4, holder_kind = $5, holder_id = $6,
              waiting_on_kind = $7, waiting_on_id = $8, waiting_since = $9, due = $10, state = $11,
              purpose = $12, done_at = $13, updated_at = now(),
              taken_over_from_kind = case when holder_kind = $5 and holder_id = $6
                then taken_over_from_kind end,
              taken_over_from_id = case when holder_kind = $5 and holder_id = $6
                then taken_over_from_id end
        where holding_id = $1 returning ${holdingColumns}`,
      [previous.holdingId, ...values],
    );
    row = rows[0] as HoldingRow;
  }
  const kept = toHolding(row);
  const id = kept.holdingId;
  if (!previous) {
    await journal(db, organizationId, id, 'holding.created', { holder: kept.holder }, now);
  } else if (!same(previous.holder, kept.holder)) {
    await journal(
      db,
      organizationId,
      id,
      'holding.taken_over',
      { from: previous.holder, to: kept.holder, because: 'source' },
      now,
    );
  }
  // A new wait: it was not waiting, or it now waits on someone else.
  if (state === 'waiting' && waitingSince === now) {
    await journal(db, organizationId, id, 'holding.waiting', { on: kept.waitingOn }, now);
  }
  if (kept.state === 'done' && previous?.state !== 'done') {
    await journal(db, organizationId, id, 'holding.done', {}, now);
  }
  return kept;
}

/** A holding of the active organization, or null. */
export async function getHolding(db: SqlExecutor, holdingId: string): Promise<Holding | null> {
  const { rows } = await db.query<HoldingRow>(
    `select ${holdingColumns} from kete_holdings where holding_id = $1`,
    [holdingId],
  );
  return rows[0] ? toHolding(rows[0]) : null;
}

/** What happened to a holding, oldest first. */
export async function holdingEvents(db: SqlExecutor, holdingId: string): Promise<HoldingEvent[]> {
  const { rows } = await db.query<{
    event_id: string;
    holding_id: string;
    type: HoldingEventType;
    data: Record<string, unknown>;
    at: Date;
  }>(
    `select event_id, holding_id, type, data, at from kete_holding_events
      where holding_id = $1 order by at, event_id`,
    [holdingId],
  );
  return rows.map((row) => ({
    eventId: row.event_id,
    holdingId: row.holding_id,
    type: row.type,
    data: row.data,
    at: new Date(row.at),
  }));
}

/**
 * Hands a holding back to whom it was taken over from (FR-003), with her reason: the person the
 * relay gave it to says it is not hers.
 */
export async function handBack(
  db: SqlExecutor,
  organizationId: string,
  input: { holdingId: string; by: Holder; reason: string },
  now = new Date(),
): Promise<Holding> {
  const { rows } = await db.query<HoldingRow>(
    `select ${holdingColumns} from kete_holdings where holding_id = $1 for update`,
    [input.holdingId],
  );
  const current = rows[0] ? toHolding(rows[0]) : null;
  if (!current) throw new HoldingError('not_found', 'No such holding in this organization.');
  if (!current.takenOverFrom || !same(current.holder, input.by)) {
    throw new HoldingError('not_taken_over', 'Only who took it over may hand it back.');
  }
  const back = current.takenOverFrom;
  const { rows: updated } = await db.query<HoldingRow>(
    `update kete_holdings
        set holder_kind = $2, holder_id = $3, taken_over_from_kind = null,
            taken_over_from_id = null, updated_at = now()
      where holding_id = $1 returning ${holdingColumns}`,
    [input.holdingId, back.kind, back.id],
  );
  await journal(
    db,
    organizationId,
    input.holdingId,
    'holding.handed_back',
    { from: input.by, to: back, reason: input.reason.slice(0, 500) },
    now,
  );
  return toHolding(updated[0] as HoldingRow);
}
