import { newId } from '@kete/records';
import { validateHolding, type Holding as SaidHolding } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';

// A thing in progress and who holds it (contract holding.v1, spec 111, doctrine D-056). An app says
// it under its source; said again, it replaces what was said. It always has a holder: a person, who
// answers for it; an agent works it as her delegate, and the result returns to whom it says (D-061,
// spec 140).

export interface Holder {
  kind: 'person' | 'agent';
  id: string;
}

export interface WaitingOn {
  /** A holding waited on comes back to its holder when that one is done (spec 139). */
  kind: 'person' | 'agent' | 'party' | 'holding';
  id: string;
}

export type HoldingState = 'held' | 'waiting' | 'done';

/** How urgent a holding is (spec 139, FR-010): « Pour moi » sorts by it first. */
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export const priorities: readonly Priority[] = ['urgent', 'high', 'normal', 'low'];

/** The agent working a holding for its holder (spec 140, FR-016). */
export interface Delegate {
  kind: 'agent';
  id: string;
}

export interface Holding {
  holdingId: string;
  source: { app: string; kind: string; ref: string };
  object: { kind: string; id: string };
  what: string;
  holder: Holder;
  /** The agent working it; its holder still answers for it. */
  delegate: Delegate | null;
  /** Whom the result goes to when done; absent: the product's rule (whoever entrusted it). */
  returnTo: Holder | null;
  waitingOn: WaitingOn | null;
  /** Since when it waits on `waitingOn`. */
  waitingSince: Date | null;
  since: Date;
  /** The day it is due, in the organization's time (`2026-10-16`). */
  due: string | null;
  priority: Priority;
  /** Put off by its holder until then: « Pour moi » does not show it before. */
  snoozedUntil: Date | null;
  state: HoldingState;
  purpose: 'action' | 'information';
  /** Where it opens, as its app said it: an https address of the app, or a path of the center. */
  href: string | null;
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
  | 'holding.prioritized'
  | 'holding.snoozed'
  | 'holding.resumed'
  | 'holding.delegated'
  | 'holding.undelegated'
  | 'holding.returned'
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
    readonly code:
      | 'holder_required'
      | 'invalid_holding'
      | 'not_found'
      | 'not_taken_over'
      | 'not_the_holder',
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
  delegate_id: string | null;
  return_to_kind: Holder['kind'] | null;
  return_to_id: string | null;
  waiting_on_kind: WaitingOn['kind'] | null;
  waiting_on_id: string | null;
  waiting_since: Date | null;
  since: Date;
  due: string | Date | null;
  priority: Priority;
  snoozed_until: Date | null;
  state: HoldingState;
  purpose: 'action' | 'information';
  href: string | null;
  taken_over_from_kind: Holder['kind'] | null;
  taken_over_from_id: string | null;
  last_nudged_at: Date | null;
  done_at: Date | null;
}

export const holdingColumns = `holding_id, source_app, source_kind, source_ref, object_kind, object_id,
  what, holder_kind, holder_id, delegate_id, return_to_kind, return_to_id, waiting_on_kind, waiting_on_id, waiting_since, since,
  to_char(due, 'YYYY-MM-DD') as due, priority, snoozed_until, state, purpose, href,
  taken_over_from_kind, taken_over_from_id, last_nudged_at, done_at`;

const date = (value: Date | null) => (value ? new Date(value) : null);

export function toHolding(row: HoldingRow): Holding {
  return {
    holdingId: row.holding_id,
    source: { app: row.source_app, kind: row.source_kind, ref: row.source_ref },
    object: { kind: row.object_kind, id: row.object_id },
    what: row.what,
    holder: { kind: row.holder_kind, id: row.holder_id },
    delegate: row.delegate_id ? { kind: 'agent', id: row.delegate_id } : null,
    returnTo:
      row.return_to_kind && row.return_to_id
        ? { kind: row.return_to_kind, id: row.return_to_id }
        : null,
    waitingOn:
      row.waiting_on_kind && row.waiting_on_id
        ? { kind: row.waiting_on_kind, id: row.waiting_on_id }
        : null,
    waitingSince: date(row.waiting_since),
    since: new Date(row.since),
    due: row.due === null ? null : String(row.due),
    priority: row.priority,
    snoozedUntil: date(row.snoozed_until),
    state: row.state,
    purpose: row.purpose,
    href: row.href ?? null,
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

/** How a product reads holdings said by apps that predate D-061 (spec 140, FR-016). */
export interface SayOptions {
  /**
   * The person an agent works for: an agent said as holder becomes its delegate, and this person
   * the holder. Without it, an agent holder is kept as said.
   */
  personOf?: (agentId: string) => Promise<string | null>;
}

/**
 * Keeps a holding as an app says it (FR-001): new under its source, or replacing what was said.
 * Each change of hands, of wait, of delegate or of state is journaled. A delegate or a return said
 * once is kept when the app says the holding again without them.
 */
export async function sayHolding(
  db: SqlExecutor,
  organizationId: string,
  said: unknown,
  now = new Date(),
  options: SayOptions = {},
): Promise<Holding> {
  const holding = checkSaid(said);
  const agentHolder = holding.holder.kind === 'agent' ? holding.holder.id : null;
  const person = agentHolder && options.personOf ? await options.personOf(agentHolder) : null;
  const holder: Holder = person ? { kind: 'person', id: person } : holding.holder;
  const waitingOn = holding.state === 'done' ? null : (holding.waiting_on ?? null);
  const state = holding.state === 'waiting' && !waitingOn ? 'held' : holding.state;
  const { rows: before } = await db.query<HoldingRow>(
    `select ${holdingColumns} from kete_holdings
      where source_app = $1 and source_kind = $2 and source_ref = $3 for update`,
    [holding.source.app, holding.source.kind, holding.source.ref],
  );
  const previous = before[0] ? toHolding(before[0]) : null;
  const delegate: Delegate | null = holding.delegate
    ? { kind: 'agent', id: holding.delegate.id }
    : person && agentHolder
      ? { kind: 'agent', id: agentHolder }
      : (previous?.delegate ?? null);
  const returnTo: Holder | null = holding.return_to ?? previous?.returnTo ?? null;
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
    holder.kind,
    holder.id,
    waitingOn?.kind ?? null,
    waitingOn?.id ?? null,
    waitingSince,
    holding.due ?? null,
    state,
    holding.for ?? 'action',
    state === 'done' ? (previous?.doneAt ?? now) : null,
    holding.href ?? null,
    holding.priority ?? previous?.priority ?? 'normal',
    holding.snoozed_until ? new Date(holding.snoozed_until) : (previous?.snoozedUntil ?? null),
    delegate?.id ?? null,
    returnTo?.kind ?? null,
    returnTo?.id ?? null,
  ];
  let row: HoldingRow;
  if (!previous) {
    const { rows } = await db.query<HoldingRow>(
      `insert into kete_holdings (holding_id, organization_id, source_app, source_kind, source_ref,
         object_kind, object_id, what, holder_kind, holder_id, waiting_on_kind, waiting_on_id,
         waiting_since, due, state, purpose, done_at, href, priority, snoozed_until, delegate_id,
         return_to_kind, return_to_id, since)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
         $19, $20, $21, $22, $23, $24)
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
              purpose = $12, done_at = $13, href = $14, priority = $15, snoozed_until = $16,
              delegate_id = $17, return_to_kind = $18, return_to_id = $19, updated_at = now(),
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
  if (kept.delegate && !same(previous?.delegate ?? null, kept.delegate)) {
    await journal(db, organizationId, id, 'holding.delegated', { to: kept.delegate }, now);
  }
  // A new wait: it was not waiting, or it now waits on someone else.
  if (state === 'waiting' && waitingSince === now) {
    await journal(db, organizationId, id, 'holding.waiting', { on: kept.waitingOn }, now);
  }
  if (kept.state === 'done' && previous?.state !== 'done') {
    await journal(db, organizationId, id, 'holding.done', {}, now);
    await returned(db, organizationId, kept, now);
    await resumeWaiters(db, organizationId, id, now);
  }
  return kept;
}

/** Whom a holding returns to: the one it says, else its holder (spec 140, FR-017). */
export function returnToOf(holding: Pick<Holding, 'returnTo' | 'holder'>): Holder {
  return holding.returnTo ?? holding.holder;
}

/** A holding done goes back to whom it returns to: journaled, for the product to tell her. */
async function returned(
  db: SqlExecutor,
  organizationId: string,
  holding: Holding,
  now: Date,
): Promise<void> {
  await journal(
    db,
    organizationId,
    holding.holdingId,
    'holding.returned',
    { to: returnToOf(holding), by: holding.delegate ?? holding.holder },
    now,
  );
}

/**
 * Its holder gives a holding to an agent to work (spec 140, FR-016); she still answers for it.
 * Journaled; the agent replaces any other delegate.
 */
export async function delegateHolding(
  db: SqlExecutor,
  organizationId: string,
  input: { holdingId: string; agent: string; by: Holder },
  now = new Date(),
): Promise<Holding> {
  const current = await getHolding(db, input.holdingId);
  if (!current || current.state === 'done') {
    throw new HoldingError('not_found', 'No such open holding in this organization.');
  }
  if (!same(current.holder, input.by)) {
    throw new HoldingError('not_the_holder', 'Only its holder gives a holding to an agent.');
  }
  const { rows } = await db.query<HoldingRow>(
    `update kete_holdings set delegate_id = $2, updated_at = now()
      where holding_id = $1 returning ${holdingColumns}`,
    [input.holdingId, input.agent],
  );
  await journal(
    db,
    organizationId,
    input.holdingId,
    'holding.delegated',
    { to: { kind: 'agent', id: input.agent }, by: input.by },
    now,
  );
  return toHolding(rows[0] as HoldingRow);
}

/** Its holder takes a holding back from its agent (spec 140, FR-016); journaled. */
export async function undelegate(
  db: SqlExecutor,
  organizationId: string,
  input: { holdingId: string; by: Holder },
  now = new Date(),
): Promise<Holding> {
  const current = await getHolding(db, input.holdingId);
  if (!current) throw new HoldingError('not_found', 'No such holding in this organization.');
  if (!same(current.holder, input.by)) {
    throw new HoldingError('not_the_holder', 'Only its holder takes a holding back.');
  }
  const { rows } = await db.query<HoldingRow>(
    `update kete_holdings set delegate_id = null, updated_at = now()
      where holding_id = $1 returning ${holdingColumns}`,
    [input.holdingId],
  );
  if (current.delegate) {
    await journal(
      db,
      organizationId,
      input.holdingId,
      'holding.undelegated',
      { from: current.delegate, by: input.by },
      now,
    );
  }
  return toHolding(rows[0] as HoldingRow);
}

/** Says whom a holding returns to when done (spec 140, FR-017). */
export async function setReturnTo(
  db: SqlExecutor,
  input: { holdingId: string; to: Holder | null },
): Promise<Holding> {
  const { rows } = await db.query<HoldingRow>(
    `update kete_holdings set return_to_kind = $2, return_to_id = $3, updated_at = now()
      where holding_id = $1 returning ${holdingColumns}`,
    [input.holdingId, input.to?.kind ?? null, input.to?.id ?? null],
  );
  if (!rows[0]) throw new HoldingError('not_found', 'No such holding in this organization.');
  return toHolding(rows[0]);
}

/** The open holdings an agent works, the oldest first (spec 140, FR-016). */
export async function delegatedTo(db: SqlExecutor, agentId: string): Promise<Holding[]> {
  const { rows } = await db.query<HoldingRow>(
    `select ${holdingColumns} from kete_holdings
      where delegate_id = $1 and state <> 'done' order by since, holding_id`,
    [agentId],
  );
  return rows.map(toHolding);
}

/** The holdings that waited on one just done come back to their holders (spec 139, FR-010). */
async function resumeWaiters(
  db: SqlExecutor,
  organizationId: string,
  holdingId: string,
  now: Date,
): Promise<void> {
  const { rows } = await db.query<{ holding_id: string }>(
    `update kete_holdings
        set state = 'held', waiting_on_kind = null, waiting_on_id = null, waiting_since = null,
            updated_at = now()
      where waiting_on_kind = 'holding' and waiting_on_id = $1 and state = 'waiting'
      returning holding_id`,
    [holdingId],
  );
  for (const row of rows) {
    await journal(db, organizationId, row.holding_id, 'holding.resumed', { after: holdingId }, now);
  }
}

/** Its holder says how urgent it is (spec 139, FR-010); journaled. */
export async function prioritize(
  db: SqlExecutor,
  organizationId: string,
  input: { holdingId: string; priority: Priority },
  now = new Date(),
): Promise<Holding> {
  const { rows } = await db.query<HoldingRow>(
    `update kete_holdings set priority = $2, updated_at = now()
      where holding_id = $1 returning ${holdingColumns}`,
    [input.holdingId, input.priority],
  );
  if (!rows[0]) throw new HoldingError('not_found', 'No such holding in this organization.');
  await journal(
    db,
    organizationId,
    input.holdingId,
    'holding.prioritized',
    {
      priority: input.priority,
    },
    now,
  );
  return toHolding(rows[0]);
}

/** Its holder puts it off until a moment, or takes it back now (`until: null`); journaled. */
export async function snoozeHolding(
  db: SqlExecutor,
  organizationId: string,
  input: { holdingId: string; until: Date | null },
  now = new Date(),
): Promise<Holding> {
  const { rows } = await db.query<HoldingRow>(
    `update kete_holdings set snoozed_until = $2, updated_at = now()
      where holding_id = $1 and state <> 'done' returning ${holdingColumns}`,
    [input.holdingId, input.until],
  );
  if (!rows[0]) throw new HoldingError('not_found', 'No such open holding in this organization.');
  await journal(
    db,
    organizationId,
    input.holdingId,
    'holding.snoozed',
    {
      until: input.until?.toISOString() ?? null,
    },
    now,
  );
  return toHolding(rows[0]);
}

/** The open holdings of the active organization, the oldest first; of one app when given. */
export async function openHoldings(
  db: SqlExecutor,
  query: { app?: string } = {},
): Promise<Holding[]> {
  const { rows } = await db.query<HoldingRow>(
    `select ${holdingColumns} from kete_holdings
      where state <> 'done' and ($1::text is null or source_app = $1)
      order by since, holding_id`,
    [query.app ?? null],
  );
  return rows.map(toHolding);
}

/** Closes a holding whose source item is finished; journaled once. */
export async function finishHolding(
  db: SqlExecutor,
  organizationId: string,
  holdingId: string,
  now = new Date(),
): Promise<Holding | null> {
  const { rows } = await db.query<HoldingRow>(
    `update kete_holdings
        set state = 'done', waiting_on_kind = null, waiting_on_id = null, waiting_since = null,
            done_at = $2, updated_at = now()
      where holding_id = $1 and state <> 'done' returning ${holdingColumns}`,
    [holdingId, now],
  );
  if (!rows[0]) return null;
  const done = toHolding(rows[0]);
  await journal(db, organizationId, holdingId, 'holding.done', {}, now);
  await returned(db, organizationId, done, now);
  await resumeWaiters(db, organizationId, holdingId, now);
  return done;
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
