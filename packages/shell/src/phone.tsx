import { Button } from '@kete/design';
import { useEffect, useId, type ReactNode } from 'react';
const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

// The phone's own screens (kete-core spec 106; doctrine D-051, D-054): the morning's pile — what
// waits for her, one thing at a time, decided with a thumb — and « Terrain », the field mode: the
// next thing in large, a few large gestures, « Plein soleil » for a screen read outdoors. The same
// on a computer; made for a phone. Every word comes through props.

/** Sets « Plein soleil » on the page while `on`: the design's light mode at its strongest. */
export function useSunlight(on: boolean): void {
  useEffect(() => {
    const root = document.documentElement;
    if (on) root.setAttribute('data-sun', 'on');
    else root.removeAttribute('data-sun');
    return () => root.removeAttribute('data-sun');
  }, [on]);
}

export interface PileItem {
  key: string;
  /** What it is, in a line: « Congé de Yao, du 2 au 6 novembre ». */
  title: ReactNode;
  /** Where it comes from: « Kete Team · demandé hier ». */
  from?: ReactNode;
  /** Its card: a decision with its evidence, a draft to verify, a figure. */
  content: ReactNode;
  /** Its gestures, the first the most likely: Approve, Refuse, Later. */
  actions: ReactNode;
}

/**
 * The morning's pile (doctrine D-051): what waits for her, one card at a time — where she is in the
 * pile, the card, its gestures, what comes next — and, once empty, what her agents go on doing.
 * `index` is the card shown; her gestures move it.
 */
export function MorningPile({
  items,
  index,
  words,
  done,
}: {
  items: PileItem[];
  index: number;
  words: {
    /** The pile's name: « Ce qui vous attend ce matin ». */
    label: string;
    /** « 2 sur 5 ». */
    progress: (at: number, total: number) => string;
    /** « Ensuite : Devis Hôtel Sarakawa ». */
    next: (title: ReactNode) => ReactNode;
  };
  /** What she sees once nothing waits: « Tout est réglé », what her agents do next. */
  done: ReactNode;
}) {
  const titleId = useId();
  const item = items[index];
  if (!item) {
    return (
      <section aria-label={words.label} data-pile="done" className="flex flex-col gap-4">
        {done}
      </section>
    );
  }
  const following = items[index + 1];
  return (
    <section aria-label={words.label} data-pile={index} className="flex flex-col gap-4">
      <div
        className="flex items-center gap-3 text-body-sm text-fg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={index}
        aria-valuetext={words.progress(index + 1, items.length)}
      >
        <span className="font-number tabular-nums">{words.progress(index + 1, items.length)}</span>
        <span aria-hidden="true" className="flex flex-1 gap-1">
          {items.map((each, at) => (
            <span
              key={each.key}
              className={cx(
                'h-1 flex-1 rounded-full',
                at < index ? 'bg-accent' : at === index ? 'bg-fg' : 'bg-surface-selected',
              )}
            />
          ))}
        </span>
      </div>
      <article
        aria-labelledby={titleId}
        className="flex flex-col gap-3 rounded-box border border-line-strong bg-surface p-4 text-fg"
      >
        <header className="flex flex-col gap-0.5">
          <h2 id={titleId} className="m-0 text-title font-semibold">
            {item.title}
          </h2>
          {item.from && <span className="text-body-sm text-fg-muted">{item.from}</span>}
        </header>
        <div>{item.content}</div>
        <div className="flex flex-wrap gap-2 [&>*]:min-h-12 [&>*]:flex-1">{item.actions}</div>
      </article>
      {following && <p className="m-0 text-body-sm text-fg-muted">{words.next(following.title)}</p>}
    </section>
  );
}

/**
 * « Terrain » (doctrine D-054): for a person on a site, a phone in her hand — the next thing in
 * large, a few large gestures (dictate the report, a photo, a call), « Plein soleil » and the way
 * back. Its content is the app's.
 */
export function FieldFrame({
  label,
  next,
  gestures,
  sun,
  onSun,
  quit,
  children,
}: {
  /** « Terrain ». */
  label: ReactNode;
  /** The next thing, in large: « 10 h · Réception du matériel, La Colombe ». */
  next: ReactNode;
  /** Large gestures: each one a button or a link. */
  gestures: ReactNode;
  sun: { on: boolean; label: string };
  onSun: (on: boolean) => void;
  /** The way back to the usual frame. */
  quit: { label: string; onQuit: () => void };
  /** What follows: the report read back, the day's list. */
  children?: ReactNode;
}) {
  useSunlight(sun.on);
  return (
    <main
      data-field
      className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-6 bg-canvas px-4 pt-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] text-fg"
    >
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-line-strong px-3 py-1 text-body-sm font-semibold">
          {label}
        </span>
        <label className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 text-body-sm">
          <input
            type="checkbox"
            role="switch"
            className="size-5 accent-[var(--color-action)]"
            checked={sun.on}
            onChange={(event) => onSun(event.target.checked)}
          />
          {sun.label}
        </label>
        <Button variant="secondary" onClick={quit.onQuit}>
          {quit.label}
        </Button>
      </div>
      <div className="text-[26px] leading-tight font-semibold">{next}</div>
      <div className="flex flex-col gap-3 [&>*]:min-h-14 [&>*]:text-[17px]">{gestures}</div>
      {children}
    </main>
  );
}
