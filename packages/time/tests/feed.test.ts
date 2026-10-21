import type { DatedFact } from '@kete/sdk';
import { describe, expect, it } from 'vitest';
import { icsFeed, parseIcs } from '../src/index.js';

// Spec 139, FR-012: Abla's days in Outlook — a site visit at a moment, a leave over two days, a
// deadline; what was taken back is not there.

const facts: DatedFact[] = [
  {
    key: 'mtg_visite',
    kind: 'meeting',
    label: 'Visite Garage Bè',
    starts_at: '2026-10-23T09:00:00.000Z',
    ends_at: '2026-10-23T10:30:00.000Z',
    href: 'https://enterprise.kya.tg/projets/prj_garage_be',
  },
  { key: 'abs_abla', kind: 'absence', label: 'Congé', day: '2026-10-26', until: '2026-10-27' },
  { key: 'due_devis', kind: 'deadline', label: 'Devis Colombe', starts_at: '2026-10-24T17:00:00Z' },
  {
    key: 'mtg_annulee',
    kind: 'meeting',
    label: 'Annulée',
    starts_at: '2026-10-22T09:00:00Z',
    cancelled: true,
  },
];

describe('her days as an iCalendar feed', () => {
  it('writes what a calendar reads back, days as days and moments as moments', () => {
    const feed = icsFeed(facts, { name: 'Kete — Abla Nyuiadzi' });
    expect(feed).toContain('X-WR-CALNAME:Kete — Abla Nyuiadzi');
    expect(feed).toContain('URL;VALUE=URI:https://enterprise.kya.tg/projets/prj_garage_be');
    expect(parseIcs(feed)).toEqual([
      {
        uid: 'mtg_visite@kete',
        summary: 'Visite Garage Bè',
        start: '2026-10-23T09:00:00.000Z',
        end: '2026-10-23T10:30:00.000Z',
        allDay: false,
      },
      {
        uid: 'due_devis@kete',
        summary: 'Devis Colombe',
        start: '2026-10-24T17:00:00.000Z',
        end: '2026-10-24T17:15:00.000Z',
        allDay: false,
      },
      {
        uid: 'abs_abla@kete',
        summary: 'Congé',
        start: '2026-10-26',
        end: '2026-10-28',
        allDay: true,
      },
    ]);
  });
});
