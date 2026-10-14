import type { DatedFact } from '@kete/sdk';
import { DAY, dayStart, occurrences, overlaps, type Occurrence } from './occurrence.js';

// What the code says of a week (spec 102; doctrine D-050): the conflicts — someone expected while
// away, someone in two places at once — the free time of a person, and the blocks a list of tasks
// could take in it. Computed, never guessed: the assistant only explains and proposes what this finds.

/** Kinds that need the person to be there. */
const PRESENCE = new Set<DatedFact['kind']>(['meeting', 'task', 'milestone']);

export type Conflict =
  /** She is expected while she is away. */
  | { kind: 'absent'; person: string; absence: string; fact: string; start: number }
  /** She is expected in two places at once. */
  | { kind: 'overlap'; person: string; facts: [string, string]; start: number };

/** Every conflict among the facts, in time order. */
export function conflicts(facts: readonly DatedFact[], offsetMinutes = 0): Conflict[] {
  const all = occurrences(facts, offsetMinutes);
  const found: Conflict[] = [];
  const absences = all.filter((o) => o.kind === 'absence');
  const present = all.filter((o) => PRESENCE.has(o.kind));
  for (const absence of absences) {
    for (const fact of present) {
      if (!overlaps(fact, absence)) continue;
      for (const person of fact.people.filter((p) => absence.people.includes(p))) {
        found.push({
          kind: 'absent',
          person,
          absence: absence.key,
          fact: fact.key,
          start: fact.start,
        });
      }
    }
  }
  const timed = present.filter((o) => !o.allDay && o.end > o.start);
  for (let i = 0; i < timed.length; i += 1) {
    for (let j = i + 1; j < timed.length; j += 1) {
      const a = timed[i] as Occurrence;
      const b = timed[j] as Occurrence;
      if (!overlaps(a, b)) continue;
      for (const person of a.people.filter((p) => b.people.includes(p))) {
        found.push({ kind: 'overlap', person, facts: [a.key, b.key], start: b.start });
      }
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

export interface Workday {
  /** `08:00`, in the organization's time. */
  start: string;
  /** `18:00`. */
  end: string;
  /** The days worked, 0 for Sunday to 6 for Saturday; Monday to Friday by default. */
  days?: readonly number[];
}

export interface Slot {
  start: number;
  end: number;
}

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * A person's free time between two days (both included), within her workday: what her meetings,
 * tasks and absences leave, in slots of at least `minMinutes`.
 */
export function freeSlots(options: {
  facts: readonly DatedFact[];
  person: string;
  from: string;
  to: string;
  workday: Workday;
  offsetMinutes?: number;
  minMinutes?: number;
  /** Nothing before this moment: the past is not free time. */
  after?: number;
}): Slot[] {
  const offset = options.offsetMinutes ?? 0;
  const min = (options.minMinutes ?? 30) * 60_000;
  const workdays = new Set(options.workday.days ?? [1, 2, 3, 4, 5]);
  const busy = occurrences(options.facts, offset).filter(
    (o) => o.people.includes(options.person) && (PRESENCE.has(o.kind) || o.kind === 'absence'),
  );
  const slots: Slot[] = [];
  for (let day = dayStart(options.from, offset); day <= dayStart(options.to, offset); day += DAY) {
    const weekday = new Date(day + offset * 60_000).getUTCDay();
    if (!workdays.has(weekday)) continue;
    let free: Slot[] = [
      {
        start: Math.max(day + minutesOf(options.workday.start) * 60_000, options.after ?? 0),
        end: day + minutesOf(options.workday.end) * 60_000,
      },
    ];
    for (const taken of busy) {
      free = free.flatMap((slot) => {
        if (!overlaps(slot, taken) || taken.end === taken.start) return [slot];
        return [
          { start: slot.start, end: Math.min(slot.end, taken.start) },
          { start: Math.max(slot.start, taken.end), end: slot.end },
        ];
      });
    }
    slots.push(...free.filter((slot) => slot.end - slot.start >= min));
  }
  return slots;
}

export interface TaskToPlace {
  key: string;
  label: string;
  minutes: number;
  /** The day it is due (`2026-10-30`): a block must end before that day ends. */
  due?: string;
}

export interface Block {
  key: string;
  label: string;
  start: number;
  end: number;
  /** `before_due`: placed to end before its due day; `free`: placed in the first free time. */
  reason: 'before_due' | 'free';
}

/**
 * Blocks for tasks in free time: the soonest due first, each in the earliest slot that holds it
 * whole, starting on the half hour (`alignMinutes`); a task that fits nowhere before its due day
 * is left out — the caller says so.
 */
export function proposeBlocks(
  tasks: readonly TaskToPlace[],
  slots: readonly Slot[],
  options: { offsetMinutes?: number; alignMinutes?: number } = {},
): Block[] {
  const offsetMinutes = options.offsetMinutes ?? 0;
  const step = Math.max(options.alignMinutes ?? 30, 1) * 60_000;
  const shift = offsetMinutes * 60_000;
  const align = (moment: number) => Math.ceil((moment + shift) / step) * step - shift;
  const left = slots.map((slot) => ({ start: align(slot.start), end: slot.end }));
  const order = [...tasks].sort(
    (a, b) =>
      (a.due ? dayStart(a.due, offsetMinutes) : Infinity) -
      (b.due ? dayStart(b.due, offsetMinutes) : Infinity),
  );
  const blocks: Block[] = [];
  for (const task of order) {
    const length = task.minutes * 60_000;
    const limit = task.due ? dayStart(task.due, offsetMinutes) + DAY : Infinity;
    const slot = left.find((s) => s.end - s.start >= length && s.start + length <= limit);
    if (!slot) continue;
    blocks.push({
      key: task.key,
      label: task.label,
      start: slot.start,
      end: slot.start + length,
      reason: task.due ? 'before_due' : 'free',
    });
    slot.start = align(slot.start + length);
  }
  return blocks.sort((a, b) => a.start - b.start);
}
