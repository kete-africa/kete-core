import type { Workday } from './plan.js';

// The organization's calendar (kete-core spec 118; doctrine D-060): its working days, its hours and
// its holidays, read from Kete's settings (`kete.working_days`, `kete.working_hours`,
// `kete.holidays`) — a site or a subsidiary may have its own. Days are the organization's
// (`2026-11-02`), computed without a time zone: a day is a day wherever it is read.

export interface OrganizationCalendar {
  /** The days worked, 1 for Monday to 7 for Sunday (ISO 8601), as `kete.working_days` says. */
  workingDays: readonly number[];
  /** `08:00` to `18:00`, as `kete.working_hours` says. */
  hours: { from: string; to: string };
  /** The days not worked though they fall on a working day. */
  holidays: readonly { day: string; label: string }[];
}

/** Kete's defaults: Monday to Friday, 8 to 18, no holiday. */
export const defaultCalendar: OrganizationCalendar = {
  workingDays: [1, 2, 3, 4, 5],
  hours: { from: '08:00', to: '18:00' },
  holidays: [],
};

/** Anything that resolves settings: `resolve`, `settingsHere` or `settingsIn` of @kete/settings. */
export interface CalendarSettings {
  value<T = unknown>(key: string): T;
}

/** The calendar as the organization — or one of its units — set it. */
export function calendarFrom(settings: CalendarSettings): OrganizationCalendar {
  return {
    workingDays: settings.value<number[]>('kete.working_days'),
    hours: settings.value<{ from: string; to: string }>('kete.working_hours'),
    holidays: settings.value<{ day: string; label: string }[]>('kete.holidays'),
  };
}

const DAY = 86_400_000;
const isDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day);
const toTime = (day: string) => {
  if (!isDay(day)) throw new RangeError(`Not a day: ${day}`);
  return Date.parse(`${day}T00:00:00Z`);
};
const toDay = (time: number) => new Date(time).toISOString().slice(0, 10);
/** 1 for Monday to 7 for Sunday. */
const isoWeekday = (time: number) => new Date(time).getUTCDay() || 7;

/** The holiday a day falls on, or null. */
export function holidayOn(day: string, calendar: OrganizationCalendar): string | null {
  return calendar.holidays.find((holiday) => holiday.day === day)?.label ?? null;
}

/** Whether the organization works that day: a working weekday that is no holiday. */
export function isWorkingDay(day: string, calendar: OrganizationCalendar): boolean {
  return (
    calendar.workingDays.includes(isoWeekday(toTime(day))) && holidayOn(day, calendar) === null
  );
}

/**
 * The days worked from `from` to `to`, both included: « congé du 2 au 6 novembre » counts what
 * is really worked in between. Zero when `to` comes before `from`.
 */
export function workingDaysBetween(
  from: string,
  to: string,
  calendar: OrganizationCalendar,
): number {
  const end = toTime(to);
  let count = 0;
  for (let time = toTime(from); time <= end; time += DAY) {
    if (isWorkingDay(toDay(time), calendar)) count += 1;
  }
  return count;
}

/**
 * The `count`-th working day after `day` (before it when negative): Friday plus one is Monday, a
 * holiday is stepped over. With `count` 0, the day itself.
 */
export function addWorkingDays(day: string, count: number, calendar: OrganizationCalendar): string {
  if (!Number.isInteger(count)) throw new RangeError(`Not a number of days: ${count}`);
  if (calendar.workingDays.length === 0) throw new RangeError('A calendar without working days.');
  const step = count < 0 ? -DAY : DAY;
  let time = toTime(day);
  // A year of holidays at most: never an endless walk.
  for (let left = Math.abs(count), guard = 0; left > 0 && guard < 3_660; guard += 1) {
    time += step;
    if (isWorkingDay(toDay(time), calendar)) left -= 1;
  }
  return toDay(time);
}

/** The calendar as `freeSlots` and `proposeBlocks` read a workday (0 for Sunday to 6). */
export function workdayOf(calendar: OrganizationCalendar): Workday {
  return {
    start: calendar.hours.from,
    end: calendar.hours.to,
    days: calendar.workingDays.map((day) => day % 7),
  };
}
