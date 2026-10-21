import type { DatedFact } from '@kete/sdk';
import ical, { ICalCalendarMethod } from 'ical-generator';
import { occurrences } from './occurrence.js';

// Her days in her own calendar (spec 139, FR-012): what Kete knows of her time — her meetings,
// deadlines, absences, tasks placed — written as an iCalendar feed that Outlook, Google or Apple
// subscribe to. Kete stays the agenda's source; the calendar reads it. Built on ical-generator.

export interface FeedOptions {
  /** The calendar's name in her agenda (« Kete — Abla Nyuiadzi »). */
  name: string;
  /** Where each event leads back, when its fact gives no address. */
  origin?: string;
  /** Organization's offset from UTC, in minutes (Lomé: 0). */
  offsetMinutes?: number;
  /** How often a calendar should read it again. */
  refreshMinutes?: number;
}

/** The facts as an iCalendar text: all-day facts as days, the others at their moment. */
export function icsFeed(facts: readonly DatedFact[], options: FeedOptions): string {
  const calendar = ical({
    name: options.name,
    prodId: { company: 'Kete', product: 'Planifier', language: 'FR' },
    method: ICalCalendarMethod.PUBLISH,
    ttl: (options.refreshMinutes ?? 30) * 60,
  });
  for (const occurrence of occurrences(facts, options.offsetMinutes ?? 0)) {
    const href = occurrence.fact.href ?? options.origin;
    calendar.createEvent({
      id: `${occurrence.key}@kete`,
      summary: occurrence.label,
      start: new Date(occurrence.start),
      // An instant is shown as a quarter of an hour, as calendars do.
      end: new Date(
        occurrence.end > occurrence.start ? occurrence.end : occurrence.start + 15 * 60_000,
      ),
      allDay: occurrence.allDay,
      ...(href && /^https:\/\//.test(href) ? { url: href } : {}),
    });
  }
  return calendar.toString();
}
