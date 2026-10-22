import { CanvasIcon } from '@kete/design';
import { useState } from 'react';
import type { RunView } from './types.js';
import type { ConversationWords } from './words.js';

// A turn of Kete or an agent, as the canvas v6.2 shows it (D-061): its plan in steps, each with its
// level; open while it works, folded once finished; « Arrêter » while it runs. Linear's sessions
// and Grok's bots read this way: what it did, without drowning the thread.

const marker = {
  done: 'border-state-success bg-state-success',
  now: 'animate-spin border-accent border-r-transparent',
  todo: 'border-line-strong',
  ask: 'border-state-verify-fg bg-state-verify-surface',
} as const;

export function AgentRun({ run, words }: { run: RunView; words: ConversationWords }) {
  const working = run.steps.some((step) => step.state === 'now');
  const [open, setOpen] = useState(working);
  return (
    <div className="mt-1.5 max-w-[620px] overflow-hidden rounded-[8px] border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] text-fg-soft hover:bg-surface-hover"
      >
        <CanvasIcon name="layers" size={14} />
        <b className="font-semibold text-fg">{run.title}</b>
        <span>{run.meta}</span>
        <span className="flex-1" />
        <span className="text-fg-muted">{open ? words.fold : words.steps}</span>
      </button>
      {open && (
        <ol className="grid list-none gap-1 border-t border-line px-2.5 py-1.5">
          {run.steps.map((step, index) => (
            <li
              key={`${index}-${step.label}`}
              data-state={step.state}
              className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 text-[12.5px] text-fg data-[state=todo]:text-fg-muted"
            >
              <span
                className={`grid size-3.5 place-items-center rounded-full border-[1.5px] ${marker[step.state]}`}
                aria-hidden="true"
              >
                {step.state === 'done' && (
                  <span className="text-on-action">
                    <CanvasIcon name="ok" size={9} />
                  </span>
                )}
              </span>
              <span>{step.label}</span>
              {step.tag ? (
                <span className="rounded-[4px] bg-surface-selected px-1.5 text-[11px] font-semibold text-fg-soft">
                  {step.tag}
                </span>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ol>
      )}
      {run.live && (
        <p className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas px-2.5 py-1.5 text-[12.5px] text-fg-soft">
          <span
            className="size-3 flex-none animate-spin rounded-full border-2 border-line-strong border-t-accent"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">{run.live}</span>
          {run.onStop && (
            <button
              type="button"
              onClick={run.onStop}
              className="inline-flex h-[26px] items-center gap-1 rounded-[5px] border border-line-control px-2 font-semibold hover:bg-surface-hover"
            >
              <CanvasIcon name="stop" size={12} />
              {words.stop}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
