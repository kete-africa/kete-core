// When a board's routine runs (spec 103; doctrine D-051, D-052): every day, every working day,
// every week on a day, or every month on a date — at a time of the organization's day. The run
// reads the board, freezes it as a summary and sends it to her channel.

export interface Routine {
  every: 'day' | 'workday' | 'week' | 'month';
  /** `07:00`, in the organization's time. */
  at: string;
  /** For `week`: 0 for Sunday to 6 for Saturday; Monday by default. */
  weekday?: number;
  /** For `month`: 1 to 28; the 1st by default. */
  date?: number;
}

const DAY = 86_400_000;

/** The next run strictly after a moment, as milliseconds. */
export function nextRun(routine: Routine, after: number, offsetMinutes = 0): number {
  const [h, m] = routine.at.split(':').map(Number);
  const shift = offsetMinutes * 60_000;
  const local = after + shift;
  const midnight = Math.floor(local / DAY) * DAY;
  for (let day = 0; day <= 62; day += 1) {
    const start = midnight + day * DAY;
    const candidate = start + ((h ?? 0) * 60 + (m ?? 0)) * 60_000;
    if (candidate <= local) continue;
    const date = new Date(start);
    const weekday = date.getUTCDay();
    const ok =
      routine.every === 'day' ||
      (routine.every === 'workday' && weekday >= 1 && weekday <= 5) ||
      (routine.every === 'week' && weekday === (routine.weekday ?? 1)) ||
      (routine.every === 'month' && date.getUTCDate() === Math.min(routine.date ?? 1, 28));
    if (ok) return candidate - shift;
  }
  throw new Error('A routine runs at least once in two months.');
}
