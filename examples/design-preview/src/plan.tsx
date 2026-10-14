import {
  Button,
  PageHeader,
  TeamLanes,
  WeekCalendar,
  type CalendarDay,
  type CalendarDayItem,
  type CalendarItem,
  type CalendarTone,
  type CalendarWords,
  type LaneRow,
} from '@kete/design';
import type { DatedFact } from '@kete/sdk';
import {
  conflicts,
  freeSlots,
  occurrences,
  placeInDays,
  proposeBlocks,
  type Block,
  type Occurrence,
} from '@kete/time';
import { useMemo, useState } from 'react';

// Planifier (kete-core spec 102; doctrine D-050), as the center shows it: the week of the canvas
// computed by @kete/time — Kossi away Thursday and Friday, the reception on Friday — and drawn by
// the calendar of @kete/design. The proposals are hers to keep or remove.

const AFI = 'usr_afi';
const KOSSI = 'usr_kossi';
const YAO = 'usr_yao';
const people: Record<string, { name: string; role: string }> = {
  [AFI]: { name: 'Afi Mensah', role: 'Directrice' },
  [KOSSI]: { name: 'Kossi Adjo', role: 'Chef de projet' },
  [YAO]: { name: 'Yao Amegah', role: 'Technicien' },
};

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
  },
  {
    key: 'routine',
    kind: 'agent_run',
    label: 'Relances (routine)',
    starts_at: '2026-10-12T08:00:00Z',
    ends_at: '2026-10-12T08:25:00Z',
    person_ids: [AFI],
  },
  {
    key: 'treasury',
    kind: 'meeting',
    label: 'Revue de trésorerie',
    starts_at: '2026-10-12T15:00:00Z',
    ends_at: '2026-10-12T16:00:00Z',
    person_ids: [AFI],
  },
  {
    key: 'site',
    kind: 'meeting',
    label: 'Point chantier La Colombe',
    starts_at: '2026-10-13T09:00:00Z',
    ends_at: '2026-10-13T09:30:00Z',
    person_ids: [AFI, KOSSI, YAO],
  },
  {
    key: 'bank',
    kind: 'meeting',
    label: 'Ecobank — ligne de crédit',
    starts_at: '2026-10-14T11:00:00Z',
    ends_at: '2026-10-14T12:00:00Z',
    person_ids: [AFI],
    visibility: 'busy',
  },
  {
    key: 'committee',
    kind: 'task',
    label: 'Préparer le comité du 20',
    starts_at: '2026-10-15T08:30:00Z',
    ends_at: '2026-10-15T10:00:00Z',
    person_ids: [AFI],
  },
  {
    key: 'pharmacy',
    kind: 'meeting',
    label: 'Pharmacie du Port',
    starts_at: '2026-10-15T15:00:00Z',
    ends_at: '2026-10-15T16:00:00Z',
    person_ids: [AFI],
  },
  { key: 'invoice', kind: 'deadline', label: 'Échéance F-2026-0003', day: '2026-10-15' },
];

const FROM = '2026-10-12';
const NOW = Date.parse('2026-10-13T10:40:00Z');
const names = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const days: CalendarDay[] = names.map((label, index) => ({
  key: String(12 + index),
  label,
  number: 12 + index,
  today: index === 1,
  rest: index > 4,
}));

const time = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
};
const words: CalendarWords = {
  label: 'Semaine du 12 octobre',
  allDay: 'Journée',
  time,
  now: 'maintenant',
  proposed: 'Proposé',
};

const toneOf = (o: Occurrence): CalendarTone =>
  o.kind === 'meeting' ? 'meeting' : o.kind === 'agent_run' ? 'agent' : 'task';

export function PlanPage() {
  const [scope, setScope] = useState<'me' | 'team'>('me');
  const [given, setGiven] = useState<string | null>(null);
  const [kept, setKept] = useState<Record<string, 'kept' | 'dropped'>>({});

  const facts = useMemo(
    () =>
      week.map((fact) =>
        fact.key === 'reception' && given ? ({ ...fact, person_ids: [given] } as DatedFact) : fact,
      ),
    [given],
  );
  const clashes = conflicts(facts).filter((c) => c.kind === 'absent');
  const blocks: Block[] = useMemo(
    () =>
      proposeBlocks(
        [
          {
            key: 'p-report',
            label: 'Rapport au Fonds Énergie Rurale',
            minutes: 90,
            due: '2026-10-30',
          },
          { key: 'p-call', label: 'Relancer la Pharmacie du Port', minutes: 30, due: '2026-10-15' },
        ],
        freeSlots({
          facts,
          person: AFI,
          from: '2026-10-13',
          to: '2026-10-16',
          workday: { start: '08:00', end: '18:00' },
          after: NOW,
          minMinutes: 30,
        }),
      ),
    [facts],
  );

  const mine = occurrences(facts).filter(
    (o) => o.people.length === 0 || o.people.includes(AFI) || o.kind === 'absence',
  );
  const placed = placeInDays(mine, { from: FROM });
  const allDay: CalendarDayItem[] = placed.allDay.map((p) => ({
    key: `${p.occurrence.key}-${p.day}`,
    day: p.day,
    label:
      p.occurrence.kind === 'absence'
        ? `${people[p.occurrence.people[0] ?? '']?.name.split(' ')[0] ?? ''} en congé`
        : p.occurrence.label,
    tone: p.occurrence.kind === 'absence' ? 'absence' : 'deadline',
    color: 'var(--app-finance)',
  }));
  const items: CalendarItem[] = placed.timed.map((p) => ({
    key: `${p.occurrence.key}-${p.day}`,
    day: p.day,
    from: p.from,
    to: p.to,
    title: p.occurrence.label,
    tone: toneOf(p.occurrence),
  }));
  // What Afi must see of the team: the reception that clashes, on its day.
  for (const clash of clashes) {
    const at = placeInDays(
      occurrences(facts).filter((o) => o.key === clash.fact),
      { from: FROM },
    ).timed[0];
    if (at)
      items.push({
        key: `clash-${clash.fact}`,
        day: at.day,
        from: at.from,
        to: at.to,
        title: at.occurrence.label,
        detail: 'Kossi est en congé',
        tone: 'conflict',
      });
  }
  for (const block of blocks) {
    if (kept[block.key] === 'dropped') continue;
    const at = placeInDays(
      [
        {
          key: block.key,
          kind: 'task',
          label: block.label,
          start: block.start,
          end: block.end,
          allDay: false,
          people: [AFI],
          fact: week[0] as DatedFact,
        },
      ],
      { from: FROM },
    ).timed[0];
    if (!at) continue;
    items.push({
      key: block.key,
      day: at.day,
      from: at.from,
      to: at.to,
      title: block.label,
      tone: kept[block.key] === 'kept' ? 'task' : 'proposal',
      ...(kept[block.key] === 'kept' ? {} : { detail: 'avant l’échéance' }),
    });
  }

  const team = occurrences(facts);
  const rows: LaneRow[] = [
    { kind: 'unit', key: 'projets', label: 'Projets · 3 personnes' },
    ...[AFI, KOSSI, YAO].map((person): LaneRow => {
      const cells = placeInDays(
        team.filter((o) => o.people.includes(person)),
        { from: FROM, days: 5 },
      );
      return {
        kind: 'person',
        key: person,
        who: people[person]?.name,
        role: people[person]?.role,
        days: [0, 1, 2, 3, 4].map((day) => [
          ...cells.allDay
            .filter((p) => p.day === day)
            .map((p) => ({ key: p.occurrence.key, label: 'En congé', tone: 'absence' as const })),
          ...cells.timed
            .filter((p) => p.day === day)
            .map((p) => ({
              key: p.occurrence.key,
              label:
                p.occurrence.fact.visibility === 'busy'
                  ? `Occupé ${time(p.from)}`
                  : `${p.occurrence.label} ${time(p.from)}`,
              tone: clashes.some((c) => c.fact === p.occurrence.key && c.person === person)
                ? ('conflict' as const)
                : ('busy' as const),
            })),
        ]),
      };
    }),
  ];

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-6">
      <PageHeader
        title="Planifier"
        description="Le temps de tout Kete : vos rendez-vous, les échéances des apps, les congés, les tâches, les passages des agents."
        actions={
          <div role="tablist" aria-label="Vue" className="flex gap-1">
            <Button
              variant={scope === 'me' ? 'primary' : 'secondary'}
              onClick={() => setScope('me')}
            >
              Ma vue
            </Button>
            <Button
              variant={scope === 'team' ? 'primary' : 'secondary'}
              onClick={() => setScope('team')}
            >
              Mon équipe
            </Button>
          </div>
        }
      />
      {clashes.length > 0 ? (
        <p className="my-4 flex flex-wrap items-center gap-3 rounded-box border border-state-error bg-state-error-surface px-4 py-3 text-body-sm text-state-error-fg">
          <span className="min-w-[220px] flex-1">
            <b>Conflit · vendredi 10 h, réception du matériel</b> — Kossi Adjo, qui en est
            responsable, est en congé jeudi et vendredi.
          </span>
          <Button onClick={() => setGiven(YAO)}>Confier à Yao</Button>
        </p>
      ) : (
        <p className="my-4 rounded-box border border-line bg-surface-control px-4 py-3 text-body-sm text-fg">
          La réception de vendredi est confiée à Yao Amegah.
        </p>
      )}
      <div className="grid items-start gap-5 min-[1000px]:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {scope === 'me' ? (
            <WeekCalendar
              days={days}
              items={items}
              allDay={allDay}
              words={words}
              now={{ day: 1, minutes: 640 }}
            />
          ) : (
            <TeamLanes
              label="Mon équipe, semaine du 12 octobre"
              days={days.slice(0, 5)}
              rows={rows}
            />
          )}
        </div>
        <aside className="rounded-box border border-line bg-surface p-4">
          <h2 className="m-0 mb-3 text-body font-semibold text-fg">Proposé par votre assistant</h2>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {blocks
              .filter((block) => !kept[block.key])
              .map((block) => (
                <li key={block.key} className="text-body-sm">
                  <b className="block text-fg">{block.label}</b>
                  <span className="text-fg-muted">
                    {names[Math.floor((block.start - Date.parse(FROM)) / 86_400_000)]}{' '}
                    {time(((block.start / 60_000) % 1440) | 0)} –{' '}
                    {time(((block.end / 60_000) % 1440) | 0)} · avant l’échéance
                  </span>
                  <span className="mt-2 flex gap-2">
                    <Button onClick={() => setKept({ ...kept, [block.key]: 'kept' })}>
                      Garder
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setKept({ ...kept, [block.key]: 'dropped' })}
                    >
                      Retirer
                    </Button>
                  </span>
                </li>
              ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
