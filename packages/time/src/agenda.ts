import type { DatedFact } from '@kete/sdk';

// A person's own agenda, outside Kete (spec 102): a port, and its first adapter — an ICS feed, the
// format every agenda exports (decision 0009: a port ships with an adapter). What it reads comes in
// as dated facts, « busy » by default: others see that she is taken, not what she does.

/** Where a person's agenda is read: the facts between two days, both included. */
export interface AgendaSource {
  read(range: { from: string; to: string }): Promise<DatedFact[]>;
}

export interface IcsEvent {
  uid: string;
  summary: string;
  /** `2026-10-16` for a whole day, an ISO moment otherwise. */
  start: string;
  end?: string;
  allDay: boolean;
}

/** The value of a date line: `20261016`, `20261016T100000Z`, or a local `20261016T100000`. */
function dateOf(value: string, offsetMinutes: number): { value: string; allDay: boolean } | null {
  const day = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (day) return { value: `${day[1]}-${day[2]}-${day[3]}`, allDay: true };
  const moment = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!moment) return null;
  const [, y, mo, d, h, mi, s, utc] = moment;
  const at = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  // A local time (with TZID, or floating) is read in the organization's time.
  return { value: new Date(utc ? at : at - offsetMinutes * 60_000).toISOString(), allDay: false };
}

const unescape = (text: string) =>
  text
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;\\])/g, '$1')
    .trim();

/** The events of an ICS text; anything it cannot read is skipped. */
export function parseIcs(text: string, offsetMinutes = 0): IcsEvent[] {
  // Long lines are folded: a line starting with a space or a tab continues the one before.
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
  const events: IcsEvent[] = [];
  let current: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT') {
      const start = current?.['DTSTART'] ? dateOf(current['DTSTART'], offsetMinutes) : null;
      if (current?.['UID'] && start && current['STATUS'] !== 'CANCELLED') {
        const end = current['DTEND'] ? dateOf(current['DTEND'], offsetMinutes) : null;
        events.push({
          uid: current['UID'],
          summary: unescape(current['SUMMARY'] ?? ''),
          start: start.value,
          ...(end ? { end: end.value } : {}),
          allDay: start.allDay,
        });
      }
      current = null;
    } else if (current) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const name = line.slice(0, colon).split(';')[0]?.toUpperCase() ?? '';
      current[name] = line.slice(colon + 1);
    }
  }
  return events;
}

/** An ICS event as a dated fact of the person whose agenda it is. */
export function icsFact(
  event: IcsEvent,
  options: { personId: string; visibility?: 'busy' | 'shared' | 'private' },
): DatedFact {
  const base = {
    key: `ics:${event.uid}`,
    kind: 'meeting' as const,
    label: event.summary || '—',
    person_ids: [options.personId],
    visibility: options.visibility ?? 'busy',
  };
  if (event.allDay) {
    // An ICS all-day event ends the day after its last day.
    const last = event.end
      ? new Date(Date.parse(`${event.end}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
      : event.start;
    return { ...base, day: event.start, ...(last > event.start ? { until: last } : {}) };
  }
  return { ...base, starts_at: event.start, ...(event.end ? { ends_at: event.end } : {}) };
}

/** A person's agenda read from an ICS feed: the events that meet the range, as dated facts. */
export function icsAgenda(
  load: () => Promise<string>,
  options: { personId: string; offsetMinutes?: number; visibility?: 'busy' | 'shared' | 'private' },
): AgendaSource {
  return {
    async read({ from, to }) {
      const events = parseIcs(await load(), options.offsetMinutes ?? 0);
      return events
        .filter((event) => {
          const first = event.start.slice(0, 10);
          const last = (event.end ?? event.start).slice(0, 10);
          return last >= from && first <= to;
        })
        .map((event) => icsFact(event, options));
    },
  };
}
