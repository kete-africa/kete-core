import { useId, type ReactNode } from 'react';
import { cx } from './components.js';

// The canvas's first wave of parts (kete-core spec 100; doctrine D-045, D-051): the decision taken
// with its evidence, an object mentioned anywhere with its card, and an agent's six states — the
// same in the center and in every app. Every word comes through props.

/** A piece of evidence beside a decision: what it is, what it says, the app it comes from. */
export interface Evidence {
  label: ReactNode;
  detail?: ReactNode;
  /** Where it is read; opened by a click. */
  href?: string;
}

/**
 * A decision waiting for a person (doctrine D-045, rule 2): its title and amount, who asks and
 * for what, its evidence, what it changes, and its gestures — Refuse, Approve, Send back, Ask, How.
 */
export function DecisionCard({
  title,
  amount,
  asker,
  evidence = [],
  children,
  actions,
  how,
}: {
  title: ReactNode;
  /** The amount or the span, in figures. */
  amount?: ReactNode;
  /** Who asks, and for what: a line. */
  asker?: ReactNode;
  evidence?: Evidence[];
  /** What deciding changes, in a sentence or two. */
  children?: ReactNode;
  /** The gestures that decide it. */
  actions: ReactNode;
  /** « Comment ? »: how it reached her. */
  how?: ReactNode;
}) {
  const titleId = useId();
  return (
    <article
      aria-labelledby={titleId}
      className="overflow-hidden rounded-box border border-line-strong bg-surface text-fg"
    >
      <header className="flex flex-wrap items-start gap-3 px-5 pt-[18px] pb-2">
        <h2 id={titleId} className="m-0 text-title font-semibold">
          {title}
        </h2>
        {amount !== undefined && (
          <span className="ml-auto font-number text-[22px] leading-7 tabular-nums">{amount}</span>
        )}
      </header>
      {asker && <p className="m-0 px-5 text-body-sm text-fg-muted">{asker}</p>}
      {evidence.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 px-5 pt-3.5 pb-1">
          {evidence.map((item, index) => {
            const content = (
              <>
                <span>{item.label}</span>
                {item.detail && <span className="text-fg-muted">{item.detail}</span>}
              </>
            );
            const className =
              'inline-flex items-center gap-2 rounded-control border border-line-control bg-surface-control px-2.5 py-1.5 text-body-sm';
            return (
              <li key={index}>
                {item.href ? (
                  <a href={item.href} className={cx(className, 'text-fg hover:border-accent')}>
                    {content}
                  </a>
                ) : (
                  <span className={className}>{content}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {children && <div className="px-5 pt-2.5 pb-3.5 text-fg-soft">{children}</div>}
      <footer className="flex flex-wrap items-center gap-2.5 border-t border-line bg-surface-control px-5 py-3.5">
        {actions}
        {how && <span className="ml-auto">{how}</span>}
      </footer>
    </article>
  );
}

/**
 * An object named anywhere — in a sentence, a conversation, an activity — with its card on hover
 * or focus: a project, a quote, a third party. The square wears the color of its app.
 */
export function Mention({
  href,
  label,
  color,
  card,
}: {
  href: string;
  label: ReactNode;
  /** The app's color, as a CSS value; the accent by default. */
  color?: string;
  /** What the card says: two or three short lines. */
  card?: ReactNode;
}) {
  const cardId = useId();
  return (
    <span className="group relative inline-block">
      <a
        href={href}
        aria-describedby={card ? cardId : undefined}
        className="inline-flex h-[22px] items-center gap-1.5 rounded-control bg-surface-selected px-[7px] align-baseline text-body-sm font-semibold whitespace-nowrap text-fg no-underline hover:ring-1 hover:ring-accent"
      >
        <span
          aria-hidden="true"
          className="inline-block size-[7px] rounded-[2px] bg-accent"
          style={color ? { background: color } : undefined}
        />
        {label}
      </a>
      {card && (
        <span
          id={cardId}
          role="tooltip"
          className="invisible absolute top-[calc(100%+6px)] left-0 z-20 w-[270px] rounded-control border border-line-overlay bg-surface-raised px-3.5 py-3 text-body-sm whitespace-normal text-fg-soft shadow-[0_8px_24px_#0005] group-focus-within:visible group-hover:visible"
        >
          {card}
        </span>
      )}
    </span>
  );
}

/** An agent's six states (doctrine D-045): the same marks everywhere. */
export type AgentRunStateName = 'asleep' | 'working' | 'waiting' | 'blocked' | 'paused' | 'stopped';

const runMarks: Record<AgentRunStateName, string> = {
  asleep: 'border-2 border-line-strong',
  working: 'border-2 border-accent border-t-transparent motion-safe:animate-spin',
  waiting: 'bg-state-verify-surface ring-[1.5px] ring-state-verify ring-inset',
  blocked: 'bg-state-error-surface ring-[1.5px] ring-state-error ring-inset',
  paused: 'bg-surface-selected',
  stopped: 'bg-surface-selected opacity-60',
};

/** Where an agent stands: asleep, working, waiting for her, blocked, paused, stopped. */
export function AgentRunState({
  state,
  children,
}: {
  state: AgentRunStateName;
  /** The state's word, and what it is doing or waiting for. */
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-body-sm text-fg" data-agent-run={state}>
      <span
        aria-hidden="true"
        className={cx('inline-block size-[18px] shrink-0 rounded-full', runMarks[state])}
      />
      {children}
    </span>
  );
}
