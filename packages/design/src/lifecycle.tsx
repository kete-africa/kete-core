import { useId, type ReactNode } from 'react';
import { AgentRunState, type AgentRunStateName } from './canvas.js';
import { cx } from './components.js';

// The lifecycle's parts (kete-core spec 105; doctrine D-045, D-053): an agent's card — its mission,
// what it reads and never does, what wakes it, its budget, its state, its gestures and their levels
// — a lesson waiting for its owner, and the tiers a skill, an agent or an app climbs. Every word
// comes through props.

export interface AgentGesture {
  key: string;
  label: ReactNode;
  /** Its level, worded: « seul », « je valide », « jamais ». */
  level: ReactNode;
  /** What its proofs say: « 19 acceptées sur 20 — peut monter d'un niveau ». */
  proof?: ReactNode;
}

/** An agent as its card shows it (doctrine D-045): a job description, not a chat. */
export function AgentCard({
  name,
  state,
  stateLabel,
  mission,
  facts,
  budget,
  gestures,
  gesturesLabel,
  actions,
}: {
  name: ReactNode;
  state: AgentRunStateName;
  /** The state's word, and what it does or waits for. */
  stateLabel: ReactNode;
  mission: ReactNode;
  /** What it reads, what it never does, what wakes it, who sees it: label and value. */
  facts: { label: ReactNode; value: ReactNode }[];
  budget?: { spent: number; limit: number; label: ReactNode };
  gestures: AgentGesture[];
  /** The gestures' heading: « Ce qu'il fait, et jusqu'où ». */
  gesturesLabel: ReactNode;
  /** Pause, resume, stop, run now. */
  actions?: ReactNode;
}) {
  const titleId = useId();
  const ratio = budget && budget.limit > 0 ? Math.min(budget.spent / budget.limit, 1) : 0;
  return (
    <article
      aria-labelledby={titleId}
      className="overflow-hidden rounded-box border border-line bg-surface text-fg"
      data-agent-card
    >
      <header className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-2">
        <h2 id={titleId} className="m-0 text-title font-semibold">
          {name}
        </h2>
        <span className="ml-auto">
          <AgentRunState state={state}>{stateLabel}</AgentRunState>
        </span>
      </header>
      <p className="m-0 px-5 pb-3 text-body text-fg-soft">{mission}</p>
      <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-line px-5 py-3 text-body-sm max-[520px]:grid-cols-1">
        {facts.map((fact, index) => (
          <div key={index} className="contents">
            <dt className="text-fg-muted">{fact.label}</dt>
            <dd className="m-0 text-fg max-[520px]:mb-1">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {budget && (
        <div className="border-t border-line px-5 py-3">
          <div className="mb-1.5 text-body-sm text-fg-muted">{budget.label}</div>
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={budget.limit}
            aria-valuenow={Math.min(budget.spent, budget.limit)}
            className="h-1.5 overflow-hidden rounded-full bg-surface-selected"
          >
            <div
              className={cx(
                'h-full rounded-full',
                ratio >= 1 ? 'bg-state-error' : ratio >= 0.8 ? 'bg-state-verify' : 'bg-accent',
              )}
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
        </div>
      )}
      <section className="border-t border-line px-5 py-3">
        <h3 className="m-0 mb-2 text-body-sm font-semibold text-fg">{gesturesLabel}</h3>
        <ul className="m-0 flex list-none flex-col p-0">
          {gestures.map((gesture) => (
            <li
              key={gesture.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-b border-line py-2 text-body-sm last:border-0"
            >
              <span className="text-fg">{gesture.label}</span>
              <span className="text-right text-fg-muted">{gesture.level}</span>
              {gesture.proof && (
                <span className="col-span-2 text-state-success-fg">{gesture.proof}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
      {actions && (
        <footer className="flex flex-wrap gap-2 border-t border-line bg-surface-control px-5 py-3">
          {actions}
        </footer>
      )}
    </article>
  );
}

/**
 * A lesson waiting for its owner (doctrine D-053): what was seen, what could change, the case it
 * came from — kept, it becomes a test case; dropped, it stays as it was.
 */
export function LessonCard({
  source,
  observed,
  proposal,
  testCase,
  labels,
  actions,
}: {
  /** Where it comes from: « Correction d'Essi · mardi ». */
  source: ReactNode;
  observed: ReactNode;
  proposal?: ReactNode;
  testCase?: ReactNode;
  /** The words of its parts: « Ce qui pourrait changer », « Le cas ». */
  labels: { proposal: ReactNode; testCase: ReactNode };
  actions?: ReactNode;
}) {
  return (
    <article
      className="flex flex-col gap-2 rounded-box border border-line bg-surface px-4 py-3 text-fg"
      data-lesson
    >
      <span className="text-body-sm text-fg-muted">{source}</span>
      <p className="m-0 text-body">{observed}</p>
      {proposal && (
        <p className="m-0 text-body-sm">
          <span className="text-fg-muted">{labels.proposal} · </span>
          {proposal}
        </p>
      )}
      {testCase && (
        <p className="m-0 rounded-control bg-surface-control px-3 py-2 text-body-sm text-fg-soft">
          <span className="text-fg-muted">{labels.testCase} · </span>
          {testCase}
        </p>
      )}
      {actions && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
    </article>
  );
}

/**
 * The tiers a resource climbs, one at a time (doctrine D-053): me, my team, my unit, the whole
 * organization — where it is, and what the next step asks.
 */
export function TierLadder({
  label,
  tiers,
  current,
  next,
}: {
  label: string;
  tiers: { key: string; label: ReactNode }[];
  current: string;
  /** What the next tier asks: its cases, its review — in words. */
  next?: ReactNode;
}) {
  const at = tiers.findIndex((tier) => tier.key === current);
  return (
    <div className="flex flex-col gap-2" data-tiers>
      <ol aria-label={label} className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
        {tiers.map((tier, index) => (
          <li key={tier.key} className="flex items-center gap-1.5">
            {index > 0 && (
              <span aria-hidden="true" className="text-fg-muted">
                ›
              </span>
            )}
            <span
              aria-current={index === at ? 'step' : undefined}
              className={cx(
                'rounded-full border px-2.5 py-0.5 text-body-sm',
                index < at && 'border-line bg-surface-selected text-fg',
                index === at && 'border-accent bg-surface-selected font-semibold text-fg',
                index > at && 'border-dashed border-line-strong text-fg-muted',
              )}
            >
              {tier.label}
            </span>
          </li>
        ))}
      </ol>
      {next && <p className="m-0 text-body-sm text-fg-muted">{next}</p>}
    </div>
  );
}
