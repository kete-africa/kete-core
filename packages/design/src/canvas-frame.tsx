import { useEffect, useId, useState, type ReactNode } from 'react';
import { cx } from './components.js';
import { CanvasIcon, type CanvasIconName } from './canvas-icon.js';

// The canvas's frame (kete-core spec 108; the validated canvas v3.1): a top bar across the whole
// width — the brand, the organization, the search in the middle, the tools — the places on the
// left, the page, and Kete Intelligence's drawer on the right; on a phone, a bar of five tabs at
// the bottom, « Demander » raised in the middle. Below 1000 px the places and the drawer slide over
// the page. Every word comes through props.

/** The square mark before a name: Kete's, or an app's in its color. */
export function FrameMark({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-[26px] shrink-0 place-items-center rounded-[5px] bg-action text-[14px] font-bold text-on-action"
      style={color ? { background: color } : undefined}
    >
      {children}
    </span>
  );
}

/** A round icon button of the frame (32 px; 40 px on a phone). */
export function FrameIconButton({
  label,
  icon,
  onClick,
  pressed,
  badge,
  className,
}: {
  label: string;
  icon: CanvasIconName;
  onClick?: () => void;
  pressed?: boolean;
  badge?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={badge ? `${label} (${badge})` : label}
      title={label}
      onClick={onClick}
      {...(pressed !== undefined ? { 'aria-pressed': pressed } : {})}
      className={cx(
        'relative inline-grid size-8 shrink-0 place-items-center rounded-[5px] text-fg-soft hover:bg-surface-hover hover:text-fg max-[640px]:size-10',
        pressed && 'bg-surface-selected text-fg',
        className,
      )}
    >
      <CanvasIcon name={icon} />
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-0.5 top-0 h-4 min-w-4 rounded-full bg-action px-1 text-[10px] font-bold leading-4 text-on-action shadow-[0_0_0_2px_var(--color-surface)]">
          {badge}
        </span>
      )}
    </button>
  );
}

/** What a place says beside its name: a count, a hot count, an agent at work, a word. */
export type PlaceExtra =
  | { kind: 'count'; value: number; hot?: boolean }
  | { kind: 'working' }
  | { kind: 'word'; value: ReactNode; hot?: boolean };

/** A place of the sidebar: its icon, its name, what waits there. `main` for the center's four. */
export function FramePlace({
  href,
  icon,
  dot,
  children,
  current,
  extra,
  main,
  sub,
}: {
  href: string;
  icon?: CanvasIconName;
  /** A project's square, in its color. */
  dot?: string | true;
  children: ReactNode;
  current?: boolean;
  extra?: PlaceExtra;
  main?: boolean;
  /** An app under « Apps ». */
  sub?: boolean;
}) {
  return (
    <a
      href={href}
      aria-current={current ? 'page' : undefined}
      className={cx(
        'group flex h-[34px] w-full items-center gap-2.5 rounded-[5px] px-2.5 text-[14px] text-fg no-underline hover:bg-surface-hover',
        main && 'h-9 font-semibold',
        sub && 'h-8 pl-10 text-[13px] text-fg-soft',
        current && 'bg-surface-selected font-semibold',
      )}
    >
      {icon && (
        <span className={cx('text-fg-soft', (current || main) && 'text-fg')}>
          <CanvasIcon name={icon} size={20} />
        </span>
      )}
      {dot && (
        <span
          aria-hidden="true"
          className="mx-1.5 size-2 shrink-0 rounded-[2px] bg-fg-muted"
          style={typeof dot === 'string' ? { background: dot } : undefined}
        />
      )}
      <span className="min-w-0 truncate transition-transform duration-150 group-hover:translate-x-[5px]">
        {children}
      </span>
      {extra?.kind === 'count' && extra.value > 0 && (
        <span
          className={cx(
            'ml-auto text-[12px] tabular-nums text-fg-muted',
            extra.hot && 'font-semibold text-fg',
          )}
        >
          {extra.value}
        </span>
      )}
      {extra?.kind === 'word' && (
        <span
          className={cx(
            'ml-auto whitespace-nowrap text-[12px] text-fg-muted',
            extra.hot && 'font-semibold text-fg',
          )}
        >
          {extra.value}
        </span>
      )}
      {extra?.kind === 'working' && (
        <span
          aria-hidden="true"
          className="ml-auto size-3.5 shrink-0 rounded-full border-2 border-line-strong border-t-accent motion-safe:animate-spin"
        />
      )}
    </a>
  );
}

/** A heading of the sidebar: « PROJETS », « ÉPINGLÉS ». */
export function FrameNavLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pt-[25px] text-[12px] uppercase tracking-[.04em] text-fg-muted">
      {children}
    </div>
  );
}

/** « Apps »: a group that opens on the apps of her organization. */
export function FrameNavGroup({
  icon,
  label,
  children,
}: {
  icon: CanvasIconName;
  label: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex h-[34px] w-full items-center gap-2.5 rounded-[5px] px-2.5 text-left text-[14px] font-semibold text-fg hover:bg-surface-hover"
      >
        <span className="text-fg-soft">
          <CanvasIcon name={icon} />
        </span>
        <span>{label}</span>
        <span className={cx('ml-auto text-fg-muted transition-transform', open && 'rotate-180')}>
          <CanvasIcon name="down" size={16} />
        </span>
      </button>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </>
  );
}

/** An app's own head in the sidebar: its mark, its name, its question; the way back to the center. */
export function FrameSpaceHead({
  mark,
  color,
  name,
  question,
  back,
}: {
  mark: ReactNode;
  color?: string;
  name: ReactNode;
  question?: ReactNode;
  back?: { href: string; label: ReactNode };
}) {
  return (
    <>
      <div className="-mx-1.5 flex items-center gap-2.5 px-2.5 pb-1 pt-2.5">
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-[5px] bg-action text-[14px] font-bold text-on-action"
          style={color ? { background: color } : undefined}
        >
          {mark}
        </span>
        <span className="min-w-0">
          <b className="block text-[15px]">{name}</b>
          {question && <small className="block text-[12px] text-fg-muted">{question}</small>}
        </span>
      </div>
      {back && (
        <a
          href={back.href}
          className="mt-1.5 flex h-8 items-center gap-2 rounded-[5px] px-2.5 text-[13px] text-fg-soft no-underline hover:bg-surface-hover hover:text-fg"
        >
          <CanvasIcon name="left" size={16} />
          {back.label}
        </a>
      )}
    </>
  );
}

/** A tab of the phone's bar; `raised` for « Demander », in the middle. */
export function FrameTab({
  href,
  onClick,
  icon,
  children,
  current,
  badge,
  raised,
}: {
  href?: string;
  onClick?: () => void;
  icon: CanvasIconName;
  children: ReactNode;
  current?: boolean;
  badge?: number;
  raised?: boolean;
}) {
  const inner = (
    <>
      {raised ? (
        <span className="grid h-8 w-[46px] place-items-center rounded-[7px] bg-agent text-on-agent">
          <CanvasIcon name={icon} />
        </span>
      ) : (
        <CanvasIcon name={icon} />
      )}
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-[calc(50%-22px)] top-1.5 h-4 min-w-4 rounded-full bg-action px-1 text-[10px] font-bold leading-4 text-on-action shadow-[0_0_0_2px_var(--color-surface)]">
          {badge}
        </span>
      )}
      <span className="max-w-full truncate px-0.5">{children}</span>
    </>
  );
  const className = cx(
    'relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 text-[11px] text-fg-muted no-underline',
    current && 'font-semibold text-fg',
  );
  return href ? (
    <a href={href} aria-current={current ? 'page' : undefined} className={className}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

/**
 * The frame of every screen of the canvas. `drawer` is Kete Intelligence, open beside the page
 * (over it below 1000 px, the whole screen on a phone); `tabs` the phone's bar.
 */
export function CanvasFrame({
  brand,
  org,
  search,
  tools,
  nav,
  navFoot,
  navLabel,
  menuLabel,
  drawer,
  tabs,
  tabsLabel,
  children,
}: {
  /** The mark and the name: « K Kete ». */
  brand: ReactNode;
  /** The organization she works in, a button that changes it. */
  org?: ReactNode;
  /** The bar that opens Ctrl K, in the middle. */
  search: ReactNode;
  /** On the right: sync, « Noter », « Demander », files, the bell, her avatar. */
  tools: ReactNode;
  nav: ReactNode;
  /** The bottom of the sidebar: « Apps », « Toutes les apps », « Administration ». */
  navFoot?: ReactNode;
  navLabel: string;
  /** The burger's name: « Places ». */
  menuLabel: string;
  drawer?: { open: boolean; wide?: boolean; label: string; content: ReactNode };
  /** The phone's five tabs; given the gesture that opens the places, for « Menu ». */
  tabs?: (openMenu: () => void) => ReactNode;
  tabsLabel?: string;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const sideId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShown(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div
      data-frame="canvas"
      className={cx(
        'grid h-dvh grid-cols-[262px_minmax(0,1fr)_auto] grid-rows-[54px_minmax(0,1fr)] overflow-hidden bg-canvas font-ui text-[14px] leading-[1.45] text-fg antialiased',
        'max-[1000px]:grid-cols-[minmax(0,1fr)]',
        tabs !== undefined && 'max-[640px]:grid-rows-[54px_minmax(0,1fr)_64px]',
      )}
    >
      <header className="col-span-full row-start-1 flex min-w-0 items-center gap-2 border-b border-line bg-surface pl-4 pr-3 max-[1000px]:pl-2 max-[640px]:justify-between max-[640px]:pl-3.5 max-[640px]:pr-2.5">
        <span className="hidden max-[1000px]:inline-grid max-[640px]:hidden">
          <FrameIconButton
            label={menuLabel}
            icon="menu"
            pressed={shown}
            onClick={() => setShown((value) => !value)}
          />
        </span>
        <div className="flex items-center gap-2.5 whitespace-nowrap text-[20px] font-semibold leading-7 tracking-[-.01em] max-[640px]:text-[18px]">
          {brand}
        </div>
        {org && <div className="ml-1.5 max-[640px]:hidden">{org}</div>}
        <div className="mx-auto flex min-w-0 max-w-[520px] flex-1 max-[640px]:hidden">{search}</div>
        <div className="flex items-center gap-1 max-[640px]:ml-auto">{tools}</div>
      </header>
      <nav
        id={sideId}
        aria-label={navLabel}
        className={cx(
          'col-start-1 row-start-2 flex min-h-0 flex-col overflow-auto border-r border-line bg-surface px-4 pb-3.5 pt-1.5',
          'max-[1000px]:fixed max-[1000px]:bottom-0 max-[1000px]:left-0 max-[1000px]:top-[54px] max-[1000px]:z-[36] max-[1000px]:w-[280px] max-[1000px]:shadow-[0_8px_24px_#0005] max-[1000px]:transition-transform max-[1000px]:duration-200',
          tabs !== undefined && 'max-[640px]:bottom-16',
          !shown && 'max-[1000px]:invisible max-[1000px]:-translate-x-[105%]',
        )}
      >
        <div className="flex flex-col">{nav}</div>
        {navFoot && (
          <div className="mt-auto flex flex-col border-t border-line pt-2.5">{navFoot}</div>
        )}
      </nav>
      <main className="@container/main col-start-2 row-start-2 min-h-0 min-w-0 overflow-auto max-[1000px]:col-start-1">
        {children}
      </main>
      {drawer?.open && (
        <aside
          aria-label={drawer.label}
          className={cx(
            'col-start-3 row-start-2 flex min-h-0 flex-col border-l border-line bg-surface',
            drawer.wide ? 'w-[min(760px,60vw)]' : 'w-[min(440px,40vw)]',
            'max-[1000px]:fixed max-[1000px]:bottom-0 max-[1000px]:right-0 max-[1000px]:top-[54px] max-[1000px]:z-[35] max-[1000px]:shadow-[0_8px_24px_#0005]',
            drawer.wide ? 'max-[1000px]:w-[min(760px,100vw)]' : 'max-[1000px]:w-[min(440px,100vw)]',
            'max-[640px]:z-[38] max-[640px]:w-screen',
          )}
        >
          {drawer.content}
        </aside>
      )}
      {tabs && (
        <nav
          aria-label={tabsLabel}
          className="col-span-full row-start-3 hidden border-t border-line bg-surface pb-[env(safe-area-inset-bottom,0px)] max-[640px]:block"
        >
          <div className="grid h-full grid-cols-5">{tabs(() => setShown(true))}</div>
        </nav>
      )}
    </div>
  );
}

/** The search in the middle of the top bar: it opens Ctrl K. */
export function FrameSearch({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-keyshortcuts="Control+K"
      className="flex h-[34px] w-full min-w-0 items-center gap-2 rounded-[5px] border border-accent bg-surface-control pl-3 pr-2.5 text-fg-muted hover:text-fg-soft"
    >
      <CanvasIcon name="search" size={16} />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <kbd className="whitespace-nowrap rounded-[4px] border border-line px-[5px] py-px font-number text-[11px] text-fg-muted">
        Ctrl K
      </kbd>
    </button>
  );
}

/** Kete Intelligence's square: the spark on the agent's color. */
export function FrameSpark({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-[6px] bg-agent text-on-agent"
      style={{ width: size, height: size }}
    >
      <CanvasIcon name="spark" size={Math.round(size * 0.58)} />
    </span>
  );
}

/** « Demander »: opens Kete Intelligence beside the page (Ctrl J). */
export function FrameAskButton({
  label,
  onClick,
  pressed,
  working,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  /** An answer is coming while the drawer is closed. */
  working?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-keyshortcuts="Control+J"
      className={cx(
        'relative flex h-8 items-center gap-[7px] whitespace-nowrap rounded-[5px] border border-line-control bg-surface-control pl-1.5 pr-3 text-[13px] font-semibold text-fg hover:bg-surface-hover max-[640px]:hidden',
        pressed && 'border-line-selected bg-surface-selected',
      )}
    >
      <FrameSpark size={22} />
      <span>{label}</span>
      {working && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 size-2.5 rounded-full bg-accent motion-safe:animate-pulse"
        />
      )}
    </button>
  );
}

/** The organization she works in: a button that changes it. */
export function FrameOrg({ name, onClick }: { name: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-[5px] border border-line-control px-2 text-[13px] text-fg-soft hover:bg-surface-hover hover:text-fg"
    >
      <span className="max-[1000px]:hidden">{name}</span>
      <CanvasIcon name="down" size={16} />
    </button>
  );
}

/** Her initials, round: her profile, her mode, the way out. */
export function FrameAvatar({
  initials,
  label,
  children,
}: {
  initials: string;
  label: string;
  /** What opens under it. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <span className="relative ml-1">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="grid size-[30px] place-items-center rounded-full bg-state-info text-[12px] font-bold text-on-action"
      >
        {initials}
      </button>
      <div
        id={id}
        hidden={!open}
        className="absolute right-0 top-[38px] z-40 w-[280px] rounded-[5px] border border-line-overlay bg-surface-raised p-3 shadow-[0_8px_24px_#0005]"
      >
        {children}
      </div>
    </span>
  );
}

/** A page in the frame: centered, 1114 px wide (1384 px when `wide`), tighter as the frame narrows. */
export function FramePage({ wide = false, children }: { wide?: boolean; children: ReactNode }) {
  return (
    <div
      className={cx(
        'mx-auto px-8 pt-10 pb-[72px] @max-[900px]/main:px-6 @max-[900px]/main:pt-7 @max-[900px]/main:pb-14 @max-[560px]/main:px-4 @max-[560px]/main:pt-5 @max-[560px]/main:pb-10',
        wide ? 'max-w-[1384px]' : 'max-w-[1114px]',
      )}
    >
      {children}
    </div>
  );
}

/** The app a page belongs to, before its title: a small square in the app's color, its name. */
export function FrameSource({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-normal text-fg-muted">
      <span
        aria-hidden="true"
        className="size-2 rounded-[2px]"
        style={{ background: color ?? 'var(--color-accent)' }}
      />
      {children}
    </span>
  );
}

/**
 * A page's head: where it sits (`crumbs`), its title, its question or what it is in a line, and its
 * actions on the right — one main action at most.
 */
export function FramePageHead({
  crumbs,
  crumbsLabel,
  title,
  status,
  question,
  sub,
  actions,
}: {
  crumbs?: ReactNode[];
  crumbsLabel?: string;
  title: ReactNode;
  /** A tag beside the title. */
  status?: ReactNode;
  /** The question the page answers. */
  question?: ReactNode;
  /** What the page is, in a line. */
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 @max-[560px]/main:mb-5">
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav
            aria-label={crumbsLabel}
            className="mb-2 flex flex-wrap items-center gap-1.5 text-body-sm text-fg-muted"
          >
            {crumbs.map((crumb, index) => (
              <span key={index} className="inline-flex items-center gap-1.5">
                {index > 0 && <span aria-hidden="true">›</span>}
                {crumb}
              </span>
            ))}
          </nav>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-[34px] leading-[42px] font-[650] tracking-[-0.015em] text-balance @max-[560px]/main:text-[24px] @max-[560px]/main:leading-8">
            {title}
          </h1>
          {status}
        </div>
        {question && <p className="mt-1.5 text-[15px] text-fg-soft">{question}</p>}
        {sub && <p className="mt-1.5 max-w-[75ch] text-fg-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
