import { CanvasIcon } from '@kete/design';
import type { ReactNode } from 'react';
import type { ListItem } from './types.js';
import type { ConversationWords } from './words.js';

// The threads on the left (canvas v6.2): by sections — the active ones, the groups, the agents with
// their state at a glance (needs you, works, has finished, idle), the direct ones, those put
// away —, each with its unread count in bold and its last words.

const badgeTone = {
  object: 'bg-accent text-on-action',
  group: 'bg-fg-soft text-surface',
  agent: 'bg-agent text-on-agent',
  party: 'bg-state-success-fg text-surface',
  muted: 'bg-line-strong text-surface',
} as const;

function Mark({
  state,
  words,
}: {
  state: NonNullable<ListItem['state']>;
  words: ConversationWords;
}) {
  if (state === 'working') {
    return (
      <span
        title={words.states.working}
        className="size-3 animate-spin rounded-full border-2 border-line-strong border-t-accent"
      />
    );
  }
  return (
    <span
      title={words.states[state]}
      data-state={state}
      className="size-2 rounded-full border-[1.5px] border-line-strong data-[state=finished]:border-accent data-[state=finished]:bg-accent data-[state=needs]:border-state-verify data-[state=needs]:bg-state-verify"
    />
  );
}

export function ThreadListPanel({
  words,
  sections,
  current,
  top,
  hidden,
}: {
  words: ConversationWords;
  sections: { label: string; items: ListItem[]; action?: ReactNode }[];
  current: string | null;
  /** Above the sections: the search, « Nouveau groupe ». */
  top?: ReactNode;
  /** On a phone, while a thread is open. */
  hidden?: boolean;
}) {
  return (
    <nav
      aria-label={words.list}
      data-hidden={hidden || undefined}
      className="flex min-h-0 flex-col gap-0.5 overflow-auto border-r border-line bg-surface px-2 pt-2.5 pb-20 max-[860px]:data-[hidden]:hidden"
    >
      {top}
      {sections.map((section) => (
        <div key={section.label} className="grid gap-0.5">
          <p className="flex items-center px-2 pt-2.5 pb-1 text-[11px] font-semibold tracking-[0.06em] text-fg-muted uppercase">
            <span className="flex-1">{section.label}</span>
            {section.action}
          </p>
          {section.items.map((item) => {
            const unread = (item.unread ?? 0) > 0;
            return (
              <a
                key={item.id}
                href={item.href}
                aria-current={item.id === current ? 'page' : undefined}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-px rounded-[6px] px-2 py-1.5 hover:bg-surface-hover aria-[current=page]:bg-surface-selected"
              >
                <span
                  className={`grid size-[22px] place-items-center rounded-[5px] text-[10px] font-bold ${badgeTone[item.badge?.tone ?? 'object']}`}
                  aria-hidden="true"
                >
                  {item.badge?.tone === 'agent' ? (
                    <CanvasIcon name="bot" size={13} />
                  ) : (
                    (item.badge?.text ?? '#')
                  )}
                </span>
                <b className={`truncate text-[13px] ${unread ? 'font-bold' : 'font-semibold'}`}>
                  {item.resolved && (
                    <span className="mr-1 inline-flex text-state-success-fg" title={words.resolved}>
                      <CanvasIcon name="ok" size={11} />
                    </span>
                  )}
                  {item.title}
                </b>
                {item.state ? (
                  <Mark state={item.state} words={words} />
                ) : unread ? (
                  <span
                    aria-label={words.unread(item.unread ?? 0)}
                    className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1.5 font-number text-[10.5px] font-bold text-on-action"
                  >
                    {item.unread}
                  </span>
                ) : (
                  <span className="text-[11px] text-fg-muted">{item.when}</span>
                )}
                {item.last && (
                  <small
                    className={`col-start-2 col-end-4 truncate text-[11.5px] ${unread ? 'text-fg' : 'text-fg-muted'}`}
                  >
                    {item.last}
                  </small>
                )}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
