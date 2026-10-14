import type { DatedFact } from '@kete/sdk';

// When a dated fact happens (contract dated-fact.v1, spec 102): a whole day — or several — read in
// the organization's own time, or a moment. Everything is computed in milliseconds since the epoch;
// a day is the organization's day, given by its offset from UTC (Lomé, Dakar, Abidjan: 0).

const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;

export interface Occurrence {
  key: string;
  kind: DatedFact['kind'];
  label: string;
  /** From, inclusive, and until, exclusive. An instant has `end === start`. */
  start: number;
  end: number;
  allDay: boolean;
  people: string[];
  fact: DatedFact;
}

/** Midnight of a day (`2026-10-16`) in the organization's time, as milliseconds. */
export function dayStart(day: string, offsetMinutes = 0): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - offsetMinutes * MINUTE;
}

/** The organization's day (`2026-10-16`) a moment falls on. */
export function dayOf(moment: number, offsetMinutes = 0): string {
  return new Date(moment + offsetMinutes * MINUTE).toISOString().slice(0, 10);
}

/** When a fact happens; null when it was taken back. */
export function occurrenceOf(fact: DatedFact, offsetMinutes = 0): Occurrence | null {
  if (fact.cancelled) return null;
  const base = {
    key: fact.key,
    kind: fact.kind,
    label: fact.label,
    people: fact.person_ids ?? [],
    fact,
  };
  if (fact.day) {
    const start = dayStart(fact.day, offsetMinutes);
    const last = dayStart(fact.until ?? fact.day, offsetMinutes);
    return { ...base, start, end: Math.max(last, start) + DAY, allDay: true };
  }
  if (!fact.starts_at) return null;
  const start = Date.parse(fact.starts_at);
  const end = fact.ends_at ? Math.max(Date.parse(fact.ends_at), start) : start;
  return { ...base, start, end, allDay: false };
}

/** The occurrences of facts still true, in time order. */
export function occurrences(facts: readonly DatedFact[], offsetMinutes = 0): Occurrence[] {
  return facts
    .map((fact) => occurrenceOf(fact, offsetMinutes))
    .filter((occurrence): occurrence is Occurrence => occurrence !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Whether two spans meet: an instant inside a span meets it. */
export function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  if (a.start === a.end) return a.start >= b.start && a.start < Math.max(b.end, b.start + 1);
  if (b.start === b.end) return b.start >= a.start && b.start < a.end;
  return a.start < b.end && b.start < a.end;
}

/** An occurrence laid on one day of a range: its day's index, and its minutes in that day. */
export interface Placed {
  occurrence: Occurrence;
  /** 0 for the range's first day. */
  day: number;
  /** Minutes from the day's midnight: `from === to` for an instant. */
  from: number;
  to: number;
}

/**
 * Occurrences laid on the days of a range, as a calendar draws them: a span of days on each of its
 * days, a moment that runs past midnight cut at it.
 */
export function placeInDays(
  list: readonly Occurrence[],
  range: { from: string; days?: number; offsetMinutes?: number },
): { allDay: Placed[]; timed: Placed[] } {
  const first = dayStart(range.from, range.offsetMinutes ?? 0);
  const allDay: Placed[] = [];
  const timed: Placed[] = [];
  for (let day = 0; day < (range.days ?? 7); day += 1) {
    const span = { start: first + day * DAY, end: first + (day + 1) * DAY };
    for (const occurrence of list) {
      if (!overlaps(occurrence, span)) continue;
      const from = Math.max(occurrence.start, span.start) - span.start;
      const to = Math.min(occurrence.end, span.end) - span.start;
      const placed = { occurrence, day, from: from / MINUTE, to: to / MINUTE };
      (occurrence.allDay ? allDay : timed).push(placed);
    }
  }
  return { allDay, timed };
}
