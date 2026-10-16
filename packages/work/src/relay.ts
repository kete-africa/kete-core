import type { DatedFact } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { dayOf, dayStart, occurrences, DAY } from '@kete/time';
import {
  holdingColumns,
  journal,
  toHolding,
  type Holder,
  type Holding,
  type HoldingRow,
  type WaitingOn,
} from './holdings.js';

// The relay (spec 111, FR-002 to FR-004): a holding never stays with nobody. When its holder is
// away, it passes to the deputy, then the manager, then the organization's head; when it waits too
// long, it is nudged, in working hours only.

/** Who stands in for whom: read from the organization's structure by the product. */
export interface Structure {
  deputyOf(personId: string): string | null;
  managerOf(personId: string): string | null;
  /** The organization's head: the last one the relay reaches. */
  head: string | null;
}

/** Whether a person is away on a day (`2026-10-16`), from the absences said as dated facts. */
export function awayOn(
  absences: readonly DatedFact[],
  personId: string,
  day: string,
  offsetMinutes = 0,
): boolean {
  const start = dayStart(day, offsetMinutes);
  return occurrences(
    absences.filter((fact) => fact.kind === 'absence'),
    offsetMinutes,
  ).some(
    (absence) =>
      absence.people.includes(personId) && absence.start < start + DAY && absence.end > start,
  );
}

/**
 * Who takes a person's holding over: her deputy, else her manager, else the head — the first one
 * present. Null when nobody is (the breach is then raised to the administrator).
 */
export function relayTarget(
  personId: string,
  structure: Structure,
  isAway: (personId: string) => boolean,
): string | null {
  const candidates = [
    structure.deputyOf(personId),
    structure.managerOf(personId),
    structure.head,
  ].filter((candidate): candidate is string => Boolean(candidate) && candidate !== personId);
  return candidates.find((candidate) => !isAway(candidate)) ?? null;
}

/** A holding that changed hands, for the product to tell the new holder on her channels. */
export interface Move {
  holding: Holding;
  from: Holder;
  to: Holder;
  because: 'absence' | 'holder_gone';
}

async function takeOver(
  db: SqlExecutor,
  organizationId: string,
  holding: Holding,
  to: string,
  because: Move['because'],
  now: Date,
): Promise<Move> {
  const { rows } = await db.query<HoldingRow>(
    `update kete_holdings
        set holder_kind = 'person', holder_id = $2,
            taken_over_from_kind = coalesce(taken_over_from_kind, holder_kind),
            taken_over_from_id = coalesce(taken_over_from_id, holder_id),
            updated_at = now()
      where holding_id = $1 returning ${holdingColumns}`,
    [holding.holdingId, to],
  );
  const moved = toHolding(rows[0] as HoldingRow);
  await journal(
    db,
    organizationId,
    holding.holdingId,
    'holding.taken_over',
    { from: holding.holder, to: moved.holder, because },
    now,
  );
  return { holding: moved, from: holding.holder, to: moved.holder, because };
}

/**
 * The relay on absence (FR-003): each open holding of a person away today, due today, overdue or
 * without a due day, passes to who stands in for her. Returns what moved and what could not.
 */
export async function relayAbsences(
  db: SqlExecutor,
  organizationId: string,
  input: {
    absences: readonly DatedFact[];
    structure: Structure;
    now?: Date;
    /** The organization's offset from UTC, in minutes (Lomé: 0). */
    offsetMinutes?: number;
  },
): Promise<{ moved: Move[]; stuck: Holding[] }> {
  const now = input.now ?? new Date();
  const today = dayOf(now.getTime(), input.offsetMinutes ?? 0);
  const isAway = (personId: string) =>
    awayOn(input.absences, personId, today, input.offsetMinutes ?? 0);
  const { rows } = await db.query<HoldingRow>(
    `select ${holdingColumns} from kete_holdings
      where state <> 'done' and purpose = 'action' and holder_kind = 'person'
        and (due is null or due <= $1::date)
      order by since, holding_id for update`,
    [today],
  );
  const moved: Move[] = [];
  const stuck: Holding[] = [];
  for (const holding of rows.map(toHolding)) {
    if (!isAway(holding.holder.id)) continue;
    const to = relayTarget(holding.holder.id, input.structure, isAway);
    if (to) moved.push(await takeOver(db, organizationId, holding, to, 'absence', now));
    else stuck.push(holding);
  }
  return { moved, stuck };
}

/**
 * Never nobody (FR-002): the open holdings whose holder is no longer there — a person who left, an
 * agent switched off — pass to her manager or the head. Those nobody can take are returned: the
 * product raises them as a card to the organization's administrator.
 */
export async function reclaimUnheld(
  db: SqlExecutor,
  organizationId: string,
  input: {
    isActive: (holder: Holder) => boolean;
    structure: Structure;
    /** Whom an agent works for, to give its holdings back to her side. */
    personOfAgent?: (agentId: string) => string | null;
    now?: Date;
  },
): Promise<{ moved: Move[]; stuck: Holding[] }> {
  const now = input.now ?? new Date();
  const { rows } = await db.query<HoldingRow>(
    `select ${holdingColumns} from kete_holdings where state <> 'done'
      order by since, holding_id for update`,
  );
  const moved: Move[] = [];
  const stuck: Holding[] = [];
  for (const holding of rows.map(toHolding)) {
    if (input.isActive(holding.holder)) continue;
    const person =
      holding.holder.kind === 'agent'
        ? (input.personOfAgent?.(holding.holder.id) ?? null)
        : holding.holder.id;
    const candidates = [
      ...(holding.holder.kind === 'agent' && person ? [person] : []),
      ...(person ? [input.structure.managerOf(person)] : []),
      input.structure.head,
    ];
    const to = candidates.find(
      (candidate): candidate is string =>
        Boolean(candidate) && input.isActive({ kind: 'person', id: candidate as string }),
    );
    if (to) moved.push(await takeOver(db, organizationId, holding, to, 'holder_gone', now));
    else stuck.push(holding);
  }
  return { moved, stuck };
}

/** When people work: days of the week (0 Sunday … 6 Saturday) and hours, in the organization's time. */
export interface WorkingHours {
  days: readonly number[];
  /** `08:00` */
  start: string;
  /** `18:00` */
  end: string;
}

export const defaultWorkingHours: WorkingHours = {
  days: [1, 2, 3, 4, 5],
  start: '08:00',
  end: '18:00',
};

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Whether a moment falls in working hours, in the organization's time. */
export function inWorkingHours(now: Date, hours: WorkingHours, offsetMinutes = 0): boolean {
  const local = new Date(now.getTime() + offsetMinutes * 60_000);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  return (
    hours.days.includes(local.getUTCDay()) &&
    minutes >= minutesOf(hours.start) &&
    minutes < minutesOf(hours.end)
  );
}

/** A nudge to give: to whom, and — for a party outside — the agent that prepares it. */
export interface Nudge {
  holding: Holding;
  to: WaitingOn;
  /** The agent in charge of nudges, when the holding waits on a party. */
  through: Holder | null;
}

/**
 * The relay on age (FR-004), in working hours only: a holding waiting on a party for longer than
 * its delay (two days by default) is offered to the agent in charge of nudges; one waiting on a
 * colleague or an agent nudges them, once a day. Each nudge is journaled; the product delivers it.
 */
export async function dueNudges(
  db: SqlExecutor,
  organizationId: string,
  input: {
    now?: Date;
    hours?: WorkingHours;
    offsetMinutes?: number;
    partyDelayDays?: number;
    nudger?: Holder | null;
  },
): Promise<Nudge[]> {
  const now = input.now ?? new Date();
  if (!inWorkingHours(now, input.hours ?? defaultWorkingHours, input.offsetMinutes ?? 0)) return [];
  const partyDelay = (input.partyDelayDays ?? 2) * DAY;
  const { rows } = await db.query<HoldingRow>(
    `select ${holdingColumns} from kete_holdings
      where state = 'waiting'
        and waiting_since <= $1::timestamptz - (case when waiting_on_kind = 'party'
              then $2::double precision else $3::double precision end) * interval '1 millisecond'
        and (last_nudged_at is null or last_nudged_at <= $1::timestamptz - interval '1 day')
      order by waiting_since, holding_id for update`,
    [now, partyDelay, DAY],
  );
  const nudges: Nudge[] = [];
  for (const holding of rows.map(toHolding)) {
    const to = holding.waitingOn as WaitingOn;
    const through = to.kind === 'party' ? (input.nudger ?? null) : null;
    await db.query(`update kete_holdings set last_nudged_at = $2 where holding_id = $1`, [
      holding.holdingId,
      now,
    ]);
    await journal(db, organizationId, holding.holdingId, 'holding.nudged', { to, through }, now);
    nudges.push({ holding: { ...holding, lastNudgedAt: now }, to, through });
  }
  return nudges;
}
