import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AgendaList,
  TeamLanes,
  WeekCalendar,
  type CalendarDay,
  type CalendarWords,
} from '../src/index.js';

// Spec 102: the week of the canvas — Afi's week, Kossi away Thursday and Friday.

const BASE_COLOR =
  /\b(?:bg|text|border|ring)-(?:primary|primary-strong|ember|ochre|root|ink|bark|clay|sand|paper|rule|success|verify|error|info|night|gray-\d+)\b/;

const days: CalendarDay[] = [
  { key: '12', label: 'lun.', number: 12 },
  { key: '13', label: 'mar.', number: 13, today: true },
  { key: '14', label: 'mer.', number: 14 },
  { key: '15', label: 'jeu.', number: 15 },
  { key: '16', label: 'ven.', number: 16 },
  { key: '17', label: 'sam.', number: 17, rest: true },
  { key: '18', label: 'dim.', number: 18, rest: true },
];
const words: CalendarWords = {
  label: 'Semaine du 12 octobre',
  allDay: 'Journée',
  time: (m) => `${Math.floor(m / 60)} h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`,
  now: 'maintenant',
  proposed: 'Proposé',
};

describe('the calendar’s parts', () => {
  it('draws a week hour by hour, a proposal hers to keep, a clash marked', () => {
    const html = renderToStaticMarkup(
      <WeekCalendar
        days={days}
        words={words}
        now={{ day: 1, minutes: 640 }}
        allDay={[
          { key: 'due', day: 3, label: 'Échéance F-2026-0003', color: 'var(--app-finance)' },
          { key: 'leave-15', day: 3, label: 'Kossi en congé', tone: 'absence' },
        ]}
        items={[
          { key: 'site', day: 1, from: 540, to: 570, title: 'Point chantier', tone: 'meeting' },
          {
            key: 'report',
            day: 1,
            from: 840,
            to: 930,
            title: 'Rapport au Fonds',
            detail: 'avant l’échéance du 30',
            tone: 'proposal',
            actions: <button type="button">Garder</button>,
          },
          { key: 'reception', day: 4, from: 600, to: 660, title: 'Réception', tone: 'conflict' },
        ]}
      />,
    );
    expect(html).toContain('aria-label="Semaine du 12 octobre"');
    expect(html).toContain('aria-current="date"');
    expect(html).toContain('data-tone="proposal"');
    expect(html).toContain('Garder');
    expect(html).toContain('data-tone="conflict"');
    expect(html).toContain('aria-label="maintenant"');
    // A time on the grid is said, not only drawn: « 14 h – 15 h30 ».
    expect(html).toContain('14 h – 15 h30');
    expect(html).toContain('background:var(--app-finance)');
    expect(html).not.toMatch(BASE_COLOR);
  });

  it('keeps a rest day narrow while empty, as wide as the others once it holds something', () => {
    const empty = renderToStaticMarkup(<WeekCalendar days={days} words={words} items={[]} />);
    expect(empty).toContain('minmax(0,.5fr) minmax(0,.5fr)');
    const busy = renderToStaticMarkup(
      <WeekCalendar
        days={days}
        words={words}
        items={[]}
        allDay={[{ key: 'devis', day: 5, label: 'Chiffre le devis Garage Bè' }]}
      />,
    );
    expect(busy).toContain('minmax(0,1fr) minmax(0,.5fr)');
  });

  it('reads the same week as a list, day by day, empty days left out', () => {
    const html = renderToStaticMarkup(
      <AgendaList
        days={days}
        words={words}
        items={[
          { key: 'b', day: 2, from: 660, to: 720, title: 'Banque' },
          { key: 'a', day: 2, from: 540, to: 570, title: 'Relancer', tone: 'proposal' },
        ]}
      />,
    );
    expect(html.match(/<h3/g)).toHaveLength(1);
    expect(html.indexOf('Relancer')).toBeLessThan(html.indexOf('Banque'));
    expect(html).toContain('Proposé');
  });

  it('shows who is away in a team’s lanes, never why', () => {
    const html = renderToStaticMarkup(
      <TeamLanes
        label="Mon équipe"
        days={days.slice(0, 5)}
        rows={[
          { kind: 'unit', key: 'projets', label: 'Projets · 2 personnes' },
          {
            kind: 'person',
            key: 'kossi',
            who: 'Kossi Adjo',
            role: 'Chef de projet',
            days: [[], [], [], [{ key: 'l', label: 'En congé', tone: 'absence' }], []],
          },
        ]}
      />,
    );
    expect(html).toContain('scope="row"');
    expect(html).toContain('colSpan="6"');
    expect(html).toContain('data-tone="absence"');
    expect(html).not.toMatch(BASE_COLOR);
  });
});
