import { describe, expect, it } from 'vitest';
import {
  addWorkingDays,
  calendarFrom,
  defaultCalendar,
  holidayOn,
  isWorkingDay,
  workdayOf,
  workingDaysBetween,
  type OrganizationCalendar,
} from '../src/index.js';

// Spec 118: the organization's calendar, read from its settings — KYA in Lomé works Monday to
// Friday; All Saints' Day (1 November) and its eve off; a site in the field works Saturdays.

const lome: OrganizationCalendar = {
  workingDays: [1, 2, 3, 4, 5],
  hours: { from: '07:30', to: '17:30' },
  holidays: [
    { day: '2026-11-01', label: 'Toussaint' },
    { day: '2026-11-02', label: 'Pont de la Toussaint' },
  ],
};

describe('the organization’s calendar', () => {
  it('knows its working days and its holidays', () => {
    expect(isWorkingDay('2026-10-30', lome)).toBe(true); // a Friday
    expect(isWorkingDay('2026-10-31', lome)).toBe(false); // a Saturday
    expect(isWorkingDay('2026-11-02', lome)).toBe(false); // a Monday, off
    expect(holidayOn('2026-11-02', lome)).toBe('Pont de la Toussaint');
    expect(holidayOn('2026-11-03', lome)).toBeNull();
  });

  it('counts the days worked between two days, both included', () => {
    // « Congé du 2 au 6 novembre »: Monday is off, four days are taken.
    expect(workingDaysBetween('2026-11-02', '2026-11-06', lome)).toBe(4);
    expect(workingDaysBetween('2026-11-06', '2026-11-02', lome)).toBe(0);
    // A site that works Saturdays.
    const site = { ...lome, workingDays: [1, 2, 3, 4, 5, 6] };
    expect(workingDaysBetween('2026-11-02', '2026-11-07', site)).toBe(5);
  });

  it('adds working days, stepping over week-ends and holidays', () => {
    // Friday 30 October plus one: Monday 2 is off, so Tuesday 3.
    expect(addWorkingDays('2026-10-30', 1, lome)).toBe('2026-11-03');
    expect(addWorkingDays('2026-11-03', -1, lome)).toBe('2026-10-30');
    expect(addWorkingDays('2026-10-31', 0, lome)).toBe('2026-10-31');
    expect(() => addWorkingDays('2026-10-30', 1, { ...lome, workingDays: [] })).toThrow();
    expect(() => addWorkingDays('30/10/2026', 1, lome)).toThrow(RangeError);
  });

  it('is read from the settings, and given to the planner as its workday', () => {
    const values: Record<string, unknown> = {
      'kete.working_days': [1, 2, 3, 4, 5, 7],
      'kete.working_hours': { from: '08:00', to: '16:00' },
      'kete.holidays': [],
    };
    const calendar = calendarFrom({ value: <T>(key: string) => values[key] as T });
    expect(calendar).toEqual({
      workingDays: [1, 2, 3, 4, 5, 7],
      hours: { from: '08:00', to: '16:00' },
      holidays: [],
    });
    // The planner counts Sunday as 0.
    expect(workdayOf(calendar)).toEqual({ start: '08:00', end: '16:00', days: [1, 2, 3, 4, 5, 0] });
    expect(defaultCalendar.workingDays).toEqual([1, 2, 3, 4, 5]);
  });
});
