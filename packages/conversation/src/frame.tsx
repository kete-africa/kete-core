import { CanvasIcon } from '@kete/design';
import type { ReactNode } from 'react';
import type { ConversationWords } from './words.js';

// The threads' frame (canvas v6.2): the list on the left, the conversation in the middle, its state
// — or « Infos du fil » — on the right. On a narrower screen the state opens over the thread; on a
// phone the list and the thread take turns.

export function ConversationFrame({
  list,
  children,
  aside,
  asideShown,
  onAsideClose,
  words,
}: {
  list: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  /** Opened over the thread on a narrower screen. */
  asideShown: boolean;
  onAsideClose: () => void;
  words: ConversationWords;
}) {
  return (
    <div className="grid h-full min-h-0 grid-cols-[250px_minmax(0,1fr)_320px] overflow-hidden max-[1180px]:grid-cols-[230px_minmax(0,1fr)] max-[860px]:grid-cols-1">
      {list}
      {children}
      {aside && (
        <aside
          aria-label={words.state}
          data-shown={asideShown || undefined}
          className="flex min-h-0 flex-col gap-4 overflow-auto border-l border-line bg-surface p-3.5 pb-20 max-[1180px]:hidden max-[1180px]:data-[shown]:fixed max-[1180px]:data-[shown]:inset-y-0 max-[1180px]:data-[shown]:right-0 max-[1180px]:data-[shown]:z-30 max-[1180px]:data-[shown]:flex max-[1180px]:data-[shown]:w-[min(340px,100%)] max-[1180px]:data-[shown]:shadow-[-8px_0_30px_#0000001f]"
        >
          <button
            type="button"
            onClick={onAsideClose}
            className="hidden items-center gap-1 self-end text-[12.5px] font-semibold text-link max-[1180px]:inline-flex"
          >
            <CanvasIcon name="x" size={14} />
            {words.close}
          </button>
          {aside}
        </aside>
      )}
    </div>
  );
}

/** The thread's head: its badge, its title — which opens « Infos du fil » —, who holds it, its gestures. */
export function ThreadHeader({
  title,
  subtitle,
  badge,
  onTitle,
  actions,
  backHref,
  words,
}: {
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  onTitle?: () => void;
  actions?: ReactNode;
  backHref?: string;
  words: ConversationWords;
}) {
  const head = (
    <>
      <h1 className="truncate text-[17px] font-semibold">{title}</h1>
      {subtitle && (
        <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-fg-muted max-[860px]:hidden">
          {subtitle}
        </span>
      )}
    </>
  );
  return (
    <header className="flex flex-none flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3 max-[860px]:gap-2 max-[860px]:px-3 max-[860px]:py-2">
      {backHref && (
        <a
          href={backHref}
          aria-label={words.back}
          className="hidden size-8 place-items-center rounded-[6px] text-fg-muted hover:bg-surface-hover max-[860px]:inline-grid"
        >
          <CanvasIcon name="left" size={16} />
        </a>
      )}
      {badge && <span className="max-[860px]:hidden">{badge}</span>}
      {onTitle ? (
        <button
          type="button"
          onClick={onTitle}
          title={words.infos}
          className="grid min-w-0 flex-1 gap-0.5 text-left hover:[&_h1]:underline"
        >
          {head}
        </button>
      ) : (
        <div className="grid min-w-0 flex-1 gap-0.5">{head}</div>
      )}
      {actions && <span className="flex flex-wrap items-center gap-1.5">{actions}</span>}
    </header>
  );
}

/** The thread's pinned messages, under its head. */
export function PinBar({ pins }: { pins: { id: string; label: string; href: string }[] }) {
  if (pins.length === 0) return null;
  return (
    <div className="flex flex-none items-center gap-2 overflow-x-auto border-b border-line bg-surface px-4 py-1.5 text-[12.5px] whitespace-nowrap [scrollbar-width:none]">
      <CanvasIcon name="pin" size={14} />
      {pins.map((pin) => (
        <a
          key={pin.id}
          href={pin.href}
          className="inline-flex h-6 items-center gap-1.5 rounded-[5px] border border-line bg-canvas px-2 font-semibold text-fg-soft hover:text-fg"
        >
          {pin.label}
        </a>
      ))}
    </div>
  );
}
