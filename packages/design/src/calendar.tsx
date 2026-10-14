import { useId, type CSSProperties, type ReactNode } from 'react';
import { cx } from './components.js';

// The calendar's parts (kete-core spec 102; doctrine D-050): the week of a person, hour by hour; the
// same week as a list on a phone; the lanes of a team, who is there and who is away. They draw what
// they are given — `placeInDays` of `@kete/time` lays the facts on the days — and every word comes
// through props.

/** A day of the range drawn. */
export interface CalendarDay {
  key: string;
  /** Its short name, `mar.`. */
  label: ReactNode;
  /** Its number in the month, `13`. */
  number: ReactNode;
  today?: boolean;
  /** A day not worked: drawn quieter, narrower. */
  rest?: boolean;
}

/**
 * meeting: people meet. task: work with its time. agent: an agent or a routine runs. proposal: put
 * there by the assistant, hers to keep or remove. conflict: someone expected cannot be there.
 */
export type CalendarTone = 'meeting' | 'task' | 'agent' | 'proposal' | 'conflict';

/** Something at a time on a day of the range. */
export interface CalendarItem {
  key: string;
  /** The day's index in `days`. */
  day: number;
  /** Minutes from the day's midnight. */
  from: number;
  to: number;
  title: ReactNode;
  /** A second line: who, from where. */
  detail?: ReactNode;
  tone?: CalendarTone;
  href?: string;
  /** Its gestures — Keep, Remove for a proposal. */
  actions?: ReactNode;
}

/** deadline: something is due. absence: someone is away — never why. conflict: a clash, all day. */
export type CalendarDayTone = 'deadline' | 'absence' | 'conflict';

/** Something that takes a whole day. */
export interface CalendarDayItem {
  key: string;
  day: number;
  label: ReactNode;
  tone?: CalendarDayTone;
  /** The color of the app it comes from, as a CSS value. */
  color?: string;
  href?: string;
}

export interface CalendarWords {
  /** The calendar's name, for assistive technologies: « Semaine du 12 octobre ». */
  label: string;
  /** The row of whole days: « Journée ». */
  allDay: ReactNode;
  /** A time of day, from its minutes: 570 → « 9 h 30 ». */
  time: (minutes: number) => string;
  /** « maintenant » */
  now?: string;
  /** A proposal's mark in the list: « Proposé ». */
  proposed?: ReactNode;
}

const itemTones: Record<CalendarTone, string> = {
  meeting: 'border border-state-info bg-state-info-surface text-state-info-fg',
  task: 'border border-line-strong bg-surface-selected text-fg',
  agent: 'border border-line-control bg-surface text-fg-muted',
  proposal: 'border border-dashed border-line-selected bg-surface text-fg-soft',
  conflict: 'border-[1.5px] border-state-error bg-state-error-surface text-state-error-fg',
};

// An absence is hatched: present, without a reason.
const hatched: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, var(--color-surface-selected) 0 6px, transparent 6px 10px)',
};

const dayTones: Record<CalendarDayTone, string> = {
  deadline: 'bg-surface-selected text-fg',
  absence: 'border border-line-strong text-fg',
  conflict: 'border border-state-error bg-state-error-surface text-state-error-fg',
};

function DayChip({ item }: { item: CalendarDayItem }) {
  const tone = item.tone ?? 'deadline';
  const className = cx(
    'flex min-w-0 items-center gap-1.5 overflow-hidden rounded-[4px] px-1.5 py-[3px] text-[11px] leading-[1.3] text-ellipsis whitespace-nowrap',
    dayTones[tone],
  );
  const content = (
    <>
      {tone !== 'absence' && (
        <span
          aria-hidden="true"
          className={cx(
            'size-[7px] shrink-0 rounded-[2px]',
            tone === 'conflict' ? 'bg-state-error' : 'bg-accent',
          )}
          style={tone === 'deadline' && item.color ? { background: item.color } : undefined}
        />
      )}
      <span className="min-w-0 truncate">{item.label}</span>
    </>
  );
  const style = tone === 'absence' ? hatched : undefined;
  return item.href ? (
    <a
      href={item.href}
      className={cx(className, 'no-underline hover:ring-1 hover:ring-accent')}
      style={style}
    >
      {content}
    </a>
  ) : (
    <span className={className} style={style}>
      {content}
    </span>
  );
}

const HOUR = 48;

/**
 * A person's week, hour by hour (doctrine D-050): the whole days on top — deadlines, absences —
 * then the hours, with what fills them; a proposal is dashed, hers to keep. On a phone the same
 * week reads as a list.
 */
export function WeekCalendar({
  days,
  items,
  allDay = [],
  hours = { from: 8, to: 19 },
  now,
  words,
}: {
  days: CalendarDay[];
  items: CalendarItem[];
  allDay?: CalendarDayItem[];
  /** The hours drawn, `8` to `19`; what falls outside shows on the edge. */
  hours?: { from: number; to: number };
  /** Where now is, when it is in the range. */
  now?: { day: number; minutes: number };
  words: CalendarWords;
}) {
  const span = Math.max(hours.to - hours.from, 1);
  const columns = `56px ${days.map((day) => (day.rest ? 'minmax(0,.5fr)' : 'minmax(0,1fr)')).join(' ')}`;
  const top = (minutes: number) => Math.min(Math.max(minutes / 60 - hours.from, 0), span) * HOUR;
  return (
    <section aria-label={words.label} data-calendar="week">
      <div className="overflow-hidden rounded-box border border-line bg-surface max-[760px]:hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid" style={{ gridTemplateColumns: columns }}>
              <div />
              {days.map((day) => (
                <div
                  key={day.key}
                  className={cx(
                    'border-l border-line px-2 pt-2 pb-1.5 text-[12px] text-fg-muted',
                    day.rest && 'bg-surface-control',
                  )}
                  aria-current={day.today ? 'date' : undefined}
                >
                  {day.label}{' '}
                  <b
                    className={cx(
                      'block font-number text-[18px] font-medium text-fg',
                      day.today && 'inline-block rounded-[5px] bg-action px-1.5 text-on-action',
                    )}
                  >
                    {day.number}
                  </b>
                </div>
              ))}
            </div>
            {allDay.length > 0 && (
              <div
                className="grid min-h-[30px] border-t border-line"
                style={{ gridTemplateColumns: columns }}
              >
                <div className="px-1.5 pt-1.5 text-[11px] text-fg-muted">{words.allDay}</div>
                {days.map((day, index) => (
                  <div
                    key={day.key}
                    className="flex min-w-0 flex-col gap-[3px] border-l border-line p-[3px]"
                  >
                    {allDay
                      .filter((item) => item.day === index)
                      .map((item) => (
                        <DayChip key={item.key} item={item} />
                      ))}
                  </div>
                ))}
              </div>
            )}
            <div
              className="relative grid border-t border-line"
              style={{ gridTemplateColumns: columns, height: span * HOUR }}
            >
              <div className="relative" aria-hidden="true">
                {Array.from({ length: span }, (_, hour) => (
                  <span
                    key={hour}
                    className="absolute right-2 -translate-y-1/2 font-number text-[11px] text-fg-muted"
                    style={{ top: hour * HOUR }}
                  >
                    {hour > 0 ? words.time((hours.from + hour) * 60) : ''}
                  </span>
                ))}
              </div>
              {days.map((day, index) => (
                <ol
                  key={day.key}
                  aria-label={
                    typeof day.label === 'string' ? `${day.label} ${String(day.number)}` : undefined
                  }
                  className={cx(
                    'relative m-0 list-none border-l border-line p-0',
                    day.rest && 'bg-surface-control',
                  )}
                  style={{
                    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR - 1}px, var(--color-line) ${HOUR - 1}px ${HOUR}px)`,
                  }}
                >
                  {items
                    .filter((item) => item.day === index)
                    .map((item) => {
                      const tone = item.tone ?? 'task';
                      const y = top(item.from);
                      const height = Math.max(top(item.to) - y - 3, 20);
                      const body = (
                        <>
                          <b className="block truncate text-[12px] font-semibold">{item.title}</b>
                          {item.detail && height >= 34 && (
                            <span className="block truncate">{item.detail}</span>
                          )}
                        </>
                      );
                      return (
                        <li
                          key={item.key}
                          data-tone={tone}
                          className={cx(
                            'absolute right-[3px] left-[3px] overflow-hidden rounded-[4px] px-1.5 py-[3px] text-[11px] leading-[1.3]',
                            itemTones[tone],
                          )}
                          style={{ top: y + 1, height }}
                        >
                          <span className="sr-only">
                            {words.time(item.from)}
                            {item.to > item.from ? ` – ${words.time(item.to)}` : ''}{' '}
                          </span>
                          {item.href ? (
                            <a href={item.href} className="text-inherit no-underline">
                              {body}
                            </a>
                          ) : (
                            body
                          )}
                          {item.actions && height >= 52 && (
                            <span className="mt-[3px] flex flex-wrap gap-1">{item.actions}</span>
                          )}
                        </li>
                      );
                    })}
                  {now && now.day === index && (
                    <li
                      aria-label={words.now}
                      className="absolute right-0 left-0 z-[2] h-0 border-t-2 border-state-error before:absolute before:-top-[6px] before:-left-[5px] before:size-2.5 before:rounded-full before:bg-state-error before:content-['']"
                      style={{ top: top(now.minutes) }}
                    />
                  )}
                </ol>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="min-[761px]:hidden">
        <AgendaList days={days} items={items} allDay={allDay} words={words} />
      </div>
    </section>
  );
}

/** The same days as a list, day by day: what a phone shows, and what a narrow column holds. */
export function AgendaList({
  days,
  items,
  allDay = [],
  words,
}: {
  days: CalendarDay[];
  items: CalendarItem[];
  allDay?: CalendarDayItem[];
  words: CalendarWords;
}) {
  const headingId = useId();
  return (
    <ol
      aria-label={words.label}
      className="m-0 list-none overflow-hidden rounded-box border border-line bg-surface p-0"
    >
      {days.map((day, index) => {
        const whole = allDay.filter((item) => item.day === index);
        const timed = items.filter((item) => item.day === index).sort((a, b) => a.from - b.from);
        if (whole.length === 0 && timed.length === 0) return null;
        return (
          <li key={day.key} aria-labelledby={`${headingId}-${index}`}>
            <h3
              id={`${headingId}-${index}`}
              className={cx(
                'm-0 border-b border-line bg-surface-control px-3.5 py-2 text-label-caps text-fg-muted',
                day.today && 'text-fg',
              )}
            >
              {day.label} {day.number}
            </h3>
            <ul className="m-0 list-none p-0">
              {whole.map((item) => (
                <li
                  key={item.key}
                  className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-line px-3.5 py-2.5"
                >
                  <span className="text-body-sm text-fg-muted">{words.allDay}</span>
                  <DayChip item={item} />
                </li>
              ))}
              {timed.map((item) => (
                <li
                  key={item.key}
                  data-tone={item.tone ?? 'task'}
                  className={cx(
                    'grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-line px-3.5 py-2.5',
                    item.tone === 'conflict' && 'bg-state-error-surface',
                  )}
                >
                  <span className="font-number text-body-sm text-fg-muted tabular-nums">
                    {words.time(item.from)}
                  </span>
                  <span className="min-w-0">
                    {item.href ? (
                      <a href={item.href} className="block font-semibold text-fg no-underline">
                        {item.title}
                      </a>
                    ) : (
                      <b className="block font-semibold text-fg">{item.title}</b>
                    )}
                    {(item.detail || item.tone === 'proposal') && (
                      <span className="block text-body-sm text-fg-muted">
                        {item.tone === 'proposal' && words.proposed}
                        {item.tone === 'proposal' && item.detail ? ' · ' : ''}
                        {item.detail}
                      </span>
                    )}
                    {item.actions && (
                      <span className="mt-1.5 flex flex-wrap gap-2">{item.actions}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/** free: there, nothing fixed. busy: taken — only that. absence: away, never why. conflict: a clash. */
export type LaneTone = 'free' | 'busy' | 'absence' | 'conflict';

export interface LaneCell {
  key: string;
  label: ReactNode;
  tone?: LaneTone;
}

/** A row of the lanes: a person and her days, or the name of a unit above its people. */
export type LaneRow =
  | { kind: 'unit'; key: string; label: ReactNode }
  | { kind: 'person'; key: string; who: ReactNode; role?: ReactNode; days: LaneCell[][] };

const laneTones: Record<LaneTone, string> = {
  free: 'bg-surface-selected text-fg',
  busy: 'bg-state-info-surface text-state-info-fg',
  absence: 'border border-line-strong text-fg',
  conflict: 'border border-state-error bg-state-error-surface text-state-error-fg',
};

/**
 * The lanes of a team or of the whole organization (doctrine D-050): who is there and who is away,
 * day by day — what each shares and what her rights open, never the reason of an absence.
 */
export function TeamLanes({
  days,
  rows,
  label,
}: {
  days: CalendarDay[];
  rows: LaneRow[];
  /** The table's name: « Mon équipe, semaine du 12 octobre ». */
  label: string;
}) {
  return (
    <div
      className="overflow-hidden rounded-box border border-line bg-surface"
      data-calendar="lanes"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[12px]" aria-label={label}>
          <thead>
            <tr>
              <th className="border-b border-line bg-surface-control p-2" />
              {days.map((day) => (
                <th
                  key={day.key}
                  scope="col"
                  aria-current={day.today ? 'date' : undefined}
                  className="border-b border-line bg-surface-control p-2 text-left font-normal whitespace-nowrap text-fg-muted"
                >
                  {day.label}
                  <b
                    className={cx(
                      'block font-number text-[15px] font-medium text-fg',
                      day.today && 'text-accent',
                    )}
                  >
                    {day.number}
                  </b>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) =>
              row.kind === 'unit' ? (
                <tr key={row.key}>
                  <th
                    scope="colgroup"
                    colSpan={days.length + 1}
                    className="border-b border-line bg-surface-control px-2 py-1.5 text-left text-label-caps font-normal text-fg-muted"
                  >
                    {row.label}
                  </th>
                </tr>
              ) : (
                <tr key={row.key}>
                  <th
                    scope="row"
                    className="min-w-[170px] border-b border-line p-2 text-left font-normal text-fg"
                  >
                    {row.who}
                    {row.role && <small className="block text-fg-muted">{row.role}</small>}
                  </th>
                  {days.map((day, index) => (
                    <td
                      key={day.key}
                      className="min-w-[90px] border-b border-l border-line p-[5px] align-top"
                    >
                      {(row.days[index] ?? []).map((cell) => (
                        <span
                          key={cell.key}
                          data-tone={cell.tone ?? 'free'}
                          className={cx(
                            'mb-[3px] block truncate rounded-[4px] px-1.5 py-[3px] text-[11px]',
                            laneTones[cell.tone ?? 'free'],
                          )}
                          style={cell.tone === 'absence' ? hatched : undefined}
                        >
                          {cell.label}
                        </span>
                      ))}
                    </td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
