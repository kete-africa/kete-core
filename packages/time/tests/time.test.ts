import type { DatedFact } from '@kete/sdk';
import { validateDatedFact } from '@kete/sdk';
import { describe, expect, it } from 'vitest';
import {
  conflicts,
  dayOf,
  freeSlots,
  icsAgenda,
  occurrences,
  parseIcs,
  placeInDays,
  proposeBlocks,
} from '../src/index.js';

// Spec 102: the week of the canvas — Kossi away Thursday and Friday, the reception on Friday.

const AFI = 'usr_afi';
const KOSSI = 'usr_kossi';
const YAO = 'usr_yao';
const at = (iso: string) => Date.parse(iso);

const week: DatedFact[] = [
  {
    key: 'leave-kossi',
    kind: 'absence',
    label: 'Congé',
    day: '2026-10-15',
    until: '2026-10-16',
    person_ids: [KOSSI],
  },
  {
    key: 'reception',
    kind: 'task',
    label: 'Réception du matériel',
    starts_at: '2026-10-16T10:00:00Z',
    ends_at: '2026-10-16T11:00:00Z',
    person_ids: [KOSSI],
    project_id: 'prj_0b7d2c1e-1111',
  },
  {
    key: 'site',
    kind: 'meeting',
    label: 'Point chantier',
    starts_at: '2026-10-13T09:00:00Z',
    ends_at: '2026-10-13T09:30:00Z',
    person_ids: [AFI, KOSSI, YAO],
  },
  {
    key: 'bank',
    kind: 'meeting',
    label: 'Banque',
    starts_at: '2026-10-14T11:00:00Z',
    ends_at: '2026-10-14T12:00:00Z',
    person_ids: [AFI],
  },
  {
    key: 'supplier',
    kind: 'meeting',
    label: 'Fournisseur',
    starts_at: '2026-10-14T11:30:00Z',
    ends_at: '2026-10-14T12:30:00Z',
    person_ids: [AFI],
  },
  { key: 'invoice-due', kind: 'deadline', label: 'Échéance F-2026-0003', day: '2026-10-15' },
  {
    key: 'old',
    kind: 'meeting',
    label: 'Annulée',
    starts_at: '2026-10-13T15:00:00Z',
    person_ids: [AFI],
    cancelled: true,
  },
];

describe('the time of a week', () => {
  it('reads every fact in the contract, a span of days as days, a taken-back fact as gone', () => {
    for (const fact of week) expect(validateDatedFact(fact).ok).toBe(true);
    const all = occurrences(week);
    expect(all.map((o) => o.key)).not.toContain('old');
    const leave = all.find((o) => o.key === 'leave-kossi');
    expect(leave).toMatchObject({
      allDay: true,
      start: at('2026-10-15T00:00:00Z'),
      end: at('2026-10-17T00:00:00Z'),
    });
    // In an organization one hour ahead of UTC, its day starts an hour earlier in UTC.
    expect(occurrences([week[0] as DatedFact], 60)[0]?.start).toBe(at('2026-10-14T23:00:00Z'));
    expect(dayOf(at('2026-10-14T23:30:00Z'), 60)).toBe('2026-10-15');
  });

  it('lays the week on its days, as a calendar draws it', () => {
    const { allDay, timed } = placeInDays(occurrences(week), { from: '2026-10-12' });
    expect(allDay.map((p) => [p.occurrence.key, p.day])).toEqual([
      ['invoice-due', 3],
      ['leave-kossi', 3],
      ['leave-kossi', 4],
    ]);
    expect(timed.find((p) => p.occurrence.key === 'reception')).toMatchObject({
      day: 4,
      from: 600,
      to: 660,
    });
    // A night shift runs past midnight: it is cut at it, on each of its two days.
    const night = occurrences([
      {
        key: 'night',
        kind: 'task',
        label: 'Garde',
        starts_at: '2026-10-13T22:00:00Z',
        ends_at: '2026-10-14T02:00:00Z',
      },
    ]);
    expect(
      placeInDays(night, { from: '2026-10-12' }).timed.map((p) => [p.day, p.from, p.to]),
    ).toEqual([
      [1, 1320, 1440],
      [2, 0, 120],
    ]);
  });

  it('finds who is expected while away, and who is in two places at once', () => {
    expect(conflicts(week)).toEqual([
      {
        kind: 'overlap',
        person: AFI,
        facts: ['bank', 'supplier'],
        start: at('2026-10-14T11:30:00Z'),
      },
      {
        kind: 'absent',
        person: KOSSI,
        absence: 'leave-kossi',
        fact: 'reception',
        start: at('2026-10-16T10:00:00Z'),
      },
    ]);
    // Given to Yao, the reception clashes with nothing.
    const settled = week.map((f) =>
      f.key === 'reception' ? ({ ...f, person_ids: [YAO] } as DatedFact) : f,
    );
    expect(conflicts(settled).filter((c) => c.kind === 'absent')).toEqual([]);
  });

  it('says a person’s free time: her workday, minus what is taken and what is past', () => {
    const slots = freeSlots({
      facts: week,
      person: AFI,
      from: '2026-10-13',
      to: '2026-10-14',
      workday: { start: '08:00', end: '18:00' },
      after: at('2026-10-13T10:40:00Z'),
    });
    expect(slots).toEqual([
      { start: at('2026-10-13T10:40:00Z'), end: at('2026-10-13T18:00:00Z') },
      { start: at('2026-10-14T08:00:00Z'), end: at('2026-10-14T11:00:00Z') },
      { start: at('2026-10-14T12:30:00Z'), end: at('2026-10-14T18:00:00Z') },
    ]);
    // Kossi's Thursday is his leave: no free time; Saturday is not a workday.
    expect(
      freeSlots({
        facts: week,
        person: KOSSI,
        from: '2026-10-15',
        to: '2026-10-17',
        workday: { start: '08:00', end: '18:00' },
      }),
    ).toEqual([]);
  });

  it('proposes blocks for tasks, the soonest due first, never past their day', () => {
    const slots = [
      { start: at('2026-10-13T14:00:00Z'), end: at('2026-10-13T15:30:00Z') },
      { start: at('2026-10-14T09:00:00Z'), end: at('2026-10-14T09:30:00Z') },
    ];
    const blocks = proposeBlocks(
      [
        { key: 'report', label: 'Rapport au Fonds', minutes: 90, due: '2026-10-30' },
        { key: 'call', label: 'Relancer la Pharmacie', minutes: 30, due: '2026-10-14' },
        { key: 'late', label: 'Trop tard', minutes: 60, due: '2026-10-12' },
      ],
      slots,
    );
    // The call takes the first half hour; the report's hour and a half fits in nothing left, and
    // the late task is past its day: both are left out, for the caller to say so.
    expect(blocks).toEqual([
      {
        key: 'call',
        label: 'Relancer la Pharmacie',
        start: at('2026-10-13T14:00:00Z'),
        end: at('2026-10-13T14:30:00Z'),
        reason: 'before_due',
      },
    ]);
    // With a free afternoon, the report finds its place — on the half hour, not at 13 h 10.
    const more = proposeBlocks(
      [{ key: 'report', label: 'Rapport au Fonds', minutes: 90, due: '2026-10-30' }],
      [{ start: at('2026-10-15T12:40:00Z'), end: at('2026-10-15T17:00:00Z') }],
    );
    expect(more).toEqual([
      {
        key: 'report',
        label: 'Rapport au Fonds',
        start: at('2026-10-15T13:00:00Z'),
        end: at('2026-10-15T14:30:00Z'),
        reason: 'before_due',
      },
    ]);
  });
});

// An agenda exported by a common provider, recorded as it comes: folded lines, a time zone, a
// whole day, a cancelled event.
const feed = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:evt-1@agenda.example',
  'DTSTART:20261014T110000Z',
  'DTEND:20261014T120000Z',
  'SUMMARY:Ecobank — ligne de crédit\\, salle 2',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:evt-2@agenda.example',
  'DTSTART;TZID=Africa/Lome:20261015T150000',
  'DTEND;TZID=Africa/Lome:20261015T160000',
  'SUMMARY:Pharmacie du Port — devis',
  '  D-2026-0002',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:evt-3@agenda.example',
  'DTSTART;VALUE=DATE:20261020',
  'DTEND;VALUE=DATE:20261022',
  'SUMMARY:Salon de l’énergie',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:evt-4@agenda.example',
  'DTSTART:20261016T090000Z',
  'STATUS:CANCELLED',
  'SUMMARY:Annulé',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('her own agenda', () => {
  it('reads an ICS feed: moments, local times, whole days; a cancelled event is gone', () => {
    expect(parseIcs(feed)).toEqual([
      {
        uid: 'evt-1@agenda.example',
        summary: 'Ecobank — ligne de crédit, salle 2',
        start: '2026-10-14T11:00:00.000Z',
        end: '2026-10-14T12:00:00.000Z',
        allDay: false,
      },
      {
        uid: 'evt-2@agenda.example',
        summary: 'Pharmacie du Port — devis D-2026-0002',
        start: '2026-10-15T15:00:00.000Z',
        end: '2026-10-15T16:00:00.000Z',
        allDay: false,
      },
      {
        uid: 'evt-3@agenda.example',
        summary: 'Salon de l’énergie',
        start: '2026-10-20',
        end: '2026-10-22',
        allDay: true,
      },
    ]);
  });

  it('brings the week’s events in as her « busy » facts, in the contract', async () => {
    const agenda = icsAgenda(() => Promise.resolve(feed), { personId: AFI });
    const facts = await agenda.read({ from: '2026-10-12', to: '2026-10-18' });
    expect(facts.map((f) => f.key)).toEqual([
      'ics:evt-1@agenda.example',
      'ics:evt-2@agenda.example',
    ]);
    for (const fact of facts) {
      expect(validateDatedFact(fact).ok).toBe(true);
      expect(fact).toMatchObject({ visibility: 'busy', person_ids: [AFI] });
    }
    const next = await agenda.read({ from: '2026-10-19', to: '2026-10-25' });
    expect(next).toEqual([
      expect.objectContaining({
        key: 'ics:evt-3@agenda.example',
        day: '2026-10-20',
        until: '2026-10-21',
      }),
    ]);
    // Her bank meeting, read from outside, clashes with what Kete knows of her Wednesday.
    expect(
      conflicts([...week, ...facts]).some(
        (c) => c.kind === 'overlap' && c.facts.includes('ics:evt-1@agenda.example'),
      ),
    ).toBe(true);
  });
});
