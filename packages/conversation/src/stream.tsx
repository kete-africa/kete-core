import { CanvasIcon } from '@kete/design';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { ShownMessage } from './types.js';
import type { ConversationWords } from './words.js';

// The conversation's flow (spec 140; canvas v6.2): the days between the messages, « Nouveaux
// messages » where she stopped, who is writing, ↓ to the newest with how many arrived, the older
// pages above. It follows the newest when she is already at the bottom, and goes to a message a
// link names (`#msg_…`).

export function MessageStream({
  messages,
  words,
  renderMessage,
  unreadFrom,
  typing = [],
  older,
  onOlder,
  empty,
  label,
}: {
  messages: ShownMessage[];
  words: ConversationWords;
  renderMessage: (message: ShownMessage) => ReactNode;
  /** The first message she has not read: the line « Nouveaux messages » goes above it. */
  unreadFrom?: string | null;
  /** Who is writing now, by name. */
  typing?: string[];
  /** There are older messages to load. */
  older?: boolean;
  onOlder?: () => void;
  empty?: ReactNode;
  label: string;
}) {
  const box = useRef<HTMLOListElement>(null);
  const atBottom = useRef(true);
  const seen = useRef(messages.length);
  const [arrived, setArrived] = useState(0);
  const last = messages.at(-1)?.first;

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const target =
      typeof window !== 'undefined' && window.location.hash
        ? document.getElementById(window.location.hash.slice(1))
        : null;
    if (target && element.contains(target)) target.scrollIntoView({ block: 'center' });
    else element.scrollTop = element.scrollHeight;
    // The first time a thread opens.
  }, [messages[0]?.thread]);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const added = messages.length - seen.current;
    seen.current = messages.length;
    if (added <= 0) return;
    if (atBottom.current) element.scrollTop = element.scrollHeight;
    else setArrived((count) => count + added);
  }, [last, messages.length]);

  let lastDay = '';
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ol
        ref={box}
        aria-label={label}
        aria-live="polite"
        onScroll={(event) => {
          const element = event.currentTarget;
          atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
          if (atBottom.current) setArrived(0);
        }}
        className="flex min-h-0 flex-1 list-none flex-col gap-3.5 overflow-auto px-4 pt-4 pb-5 max-[860px]:px-3"
      >
        {older && onOlder && (
          <li className="self-center">
            <button
              type="button"
              onClick={onOlder}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-fg-soft hover:bg-surface-hover"
            >
              <CanvasIcon name="up" size={13} />
              {words.older}
            </button>
          </li>
        )}
        {messages.length === 0 && empty && <li className="text-fg-muted">{empty}</li>}
        {messages.map((message) => {
          const day = words.day(message.at);
          const separator = day !== lastDay;
          lastDay = day;
          return (
            <li key={message.first} className="contents">
              {separator && (
                <span className="self-center rounded-full border border-line bg-surface px-2.5 py-px text-[11.5px] font-semibold text-fg-muted first-letter:uppercase">
                  {day}
                </span>
              )}
              {unreadFrom === message.first && (
                <span className="flex max-w-[760px] items-center gap-2 text-[11.5px] font-semibold text-state-error-fg before:h-px before:flex-1 before:bg-state-error after:h-px after:flex-1 after:bg-state-error">
                  {words.newMessages}
                </span>
              )}
              <ul className="contents">{renderMessage(message)}</ul>
            </li>
          );
        })}
        {typing.length > 0 && (
          <li
            className="ml-[38px] flex items-center gap-1.5 text-[12px] text-fg-muted"
            role="status"
          >
            <span className="inline-flex gap-0.5" aria-hidden="true">
              {[0, 1, 2].map((dot) => (
                <i
                  key={dot}
                  className="size-1 animate-pulse rounded-full bg-fg-muted"
                  style={{ animationDelay: `${dot * 150}ms` }}
                />
              ))}
            </span>
            {words.typing(typing)}
          </li>
        )}
      </ol>
      {arrived > 0 && (
        <button
          type="button"
          onClick={() => {
            const element = box.current;
            if (element) element.scrollTop = element.scrollHeight;
            setArrived(0);
          }}
          className="absolute right-5 bottom-3 inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-[12.5px] font-semibold shadow-[0_4px_14px_#00000024]"
        >
          <CanvasIcon name="down" size={13} />
          {words.jumpToNew(arrived)}
        </button>
      )}
    </div>
  );
}
