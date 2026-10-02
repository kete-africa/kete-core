import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cx, IconButton } from './components.js';

// The frame of the `workspace` design (doctrine D-035), from the copilot-demo workspace: a sidebar
// to start, search, reach the library, teach, find assistants and agents and recent conversations;
// a main area with a toolbar, a page title, the company's apps as cards and pills to filter them.
// Semantic tokens only: it wears a client's brand. Every word comes through props.

const iconPaths = {
  apps: 'M4 4h1m6 0h1m6 0h1M4 11h1m6 0h1m6 0h1M4 18h1m6 0h1m6 0h1',
  check: 'M8 11l3 3 5-6M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2',
  panel: 'M9 4v16M4 4h16v16H4z',
  new: 'M12 7v10M7 12h10M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  search: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  library: 'M3 3h3v18H3zM10 3h3v18h-3zM16 5l3-1 4 16-3 1z',
  teach: 'M6 4H3v16h12M6 2h7v4H6zM12 11l4-3 5 3v7l-5 3-4-3z',
  learn: 'M2 9l10-5 10 5-10 5zM6 12v5l6 3 6-3v-5M2 9v8',
  agent: 'M8 3L2 12l6 9M16 3l6 9-6 9M14 3l-4 18M18 15v6m-3-3h6',
  more: 'M4 12h1m6 0h1m6 0h1',
  download: 'M12 2v14m-5-5 5 5 5-5M4 20h16',
  chevron: 'M6 9l6 6 6-6',
  arrow: 'M3 12h18m-7-7 7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1',
  table: 'M3 4h18v16H3zM3 10h18M3 15h18M9 4v16',
  chart: 'M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4',
  columns: 'M3 4h5v16H3zM10 4h5v12h-5zM17 4h4v8h-4z',
  calendar: 'M3 6h18v15H3zM3 10h18M8 3v5M16 3v5',
  send: 'M4 12l16-8-6 16-3-6zM11 14l9-10',
  stop: 'M6 6h12v12H6z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  tool: 'M14 6a4 4 0 0 0 5 5l-9 9-3-3 9-9a4 4 0 0 1-2-2z',
  up: 'M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 3 2l-1 5h6a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 1H7',
  down: 'M7 13V4H4v9zM7 13l4 8a2 2 0 0 0 3-2l-1-5h6a2 2 0 0 0 2-2l-2-7a2 2 0 0 0-2-1H7',
  refresh: 'M20 11a8 8 0 1 0-2 6M20 4v7h-7',
} as const;

export type IconName = keyof typeof iconPaths;

/** The workspace's line icons: 1.4 px strokes, the color of the text. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

/**
 * The workspace frame. Above 760 px the sidebar is fixed beside the main area and can be collapsed;
 * below, it is a panel the person opens from the toolbar. Escape closes it.
 */
export function Shell({
  brand,
  tools,
  nav,
  footer,
  toolbar,
  navLabel,
  showNavLabel,
  hideNavLabel,
  children,
}: {
  /** The name at the top of the sidebar. */
  brand: ReactNode;
  /** Icon buttons beside the name. */
  tools?: ReactNode;
  /** NavSections. */
  nav: ReactNode;
  /** The bottom of the sidebar: the client's colors. */
  footer?: ReactNode;
  /** The toolbar's actions, on the right. */
  toolbar?: ReactNode;
  /** The accessible name of the main navigation. */
  navLabel: string;
  /** The names of the buttons that show and hide the sidebar. */
  showNavLabel: string;
  hideNavLabel: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const sidebarId = useId();
  const toggle = () => {
    if (window.innerWidth <= 760) setOpen((value) => !value);
    else setCollapsed((value) => !value);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="min-h-dvh bg-canvas font-ui text-body text-fg">
      <aside
        id={sidebarId}
        className={cx(
          'fixed inset-y-0 left-0 z-10 flex w-[262px] flex-col border-r border-line bg-surface px-4 py-3.5',
          'transition-transform duration-150 max-[1100px]:w-[230px]',
          'max-[760px]:w-[262px] max-[760px]:shadow-[8px_0_24px_#0005]',
          // Hidden, it leaves the tab order too.
          collapsed && 'min-[761px]:invisible min-[761px]:-translate-x-full',
          !open && 'max-[760px]:invisible max-[760px]:-translate-x-full',
        )}
      >
        <header className="mb-[15px] flex h-[34px] items-center justify-between gap-2">
          <div className="min-w-0 truncate text-title font-semibold">{brand}</div>
          <div className="flex gap-1">
            {tools}
            <IconButton label={hideNavLabel} aria-controls={sidebarId} onClick={toggle}>
              <Icon name="panel" />
            </IconButton>
          </div>
        </header>
        <nav aria-label={navLabel} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {nav}
        </nav>
        {footer && <div className="mt-auto pt-6 max-[760px]:pb-3">{footer}</div>}
      </aside>
      <main
        className={cx(
          'min-h-dvh pb-7 transition-[margin] duration-150',
          collapsed ? 'min-[761px]:ml-0' : 'ml-[262px] max-[1100px]:ml-[230px]',
          'max-[760px]:ml-0',
        )}
      >
        <div className="relative flex h-[54px] items-start justify-end gap-2 px-8 pt-3.5 max-[760px]:h-[62px] max-[760px]:px-4 max-[760px]:pt-3">
          <IconButton
            label={showNavLabel}
            aria-controls={sidebarId}
            aria-expanded={open}
            onClick={toggle}
            className={cx('mr-auto', !collapsed && 'min-[761px]:hidden')}
          >
            <Icon name="panel" />
          </IconButton>
          {toolbar}
        </div>
        <div className="mx-auto mt-3 max-w-[1050px] max-[1400px]:mx-[6%] max-[1100px]:mx-7 max-[1100px]:mt-[15px] max-[760px]:mx-5 max-[760px]:mt-3 min-[1450px]:mr-8 min-[1450px]:ml-[122px]">
          {children}
        </div>
      </main>
    </div>
  );
}

/** A group of the sidebar; with a label, a muted one 25 px below the previous group. */
export function NavSection({ label, children }: { label?: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <div>
      {label && (
        <p id={labelId} className="mt-[25px] mb-2.5 text-label-caps text-fg-muted">
          {label}
        </p>
      )}
      <ul className="grid" {...(label ? { 'aria-labelledby': labelId } : {})}>
        {children}
      </ul>
    </div>
  );
}

/** The look of a sidebar item, for a framework's own link component. */
export function navItemClassName(current = false): string {
  return cx(
    'flex h-(--control-height) w-full items-center gap-2.5 rounded-control text-left text-fg',
    'overflow-hidden text-ellipsis whitespace-nowrap',
    'transition-[padding,background-color] duration-150 hover:bg-surface-hover hover:pl-[5px]',
    current && 'bg-surface-hover pl-[5px] font-semibold',
  );
}

/**
 * A sidebar item: an icon and a label, or a label alone (a conversation). A link with `href`, a
 * button with `onClick`.
 */
export function NavItem({
  href,
  onClick,
  icon,
  accent = false,
  current = false,
  children,
}: {
  href?: string;
  onClick?: () => void;
  icon?: IconName;
  /** The icon in the accent, as for a featured assistant. */
  accent?: boolean;
  current?: boolean;
  children: ReactNode;
}) {
  const content = (
    <>
      {icon && (
        <span className={cx('inline-flex shrink-0', accent && 'text-accent')}>
          <Icon name={icon} />
        </span>
      )}
      <span className="min-w-0 truncate">{children}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <a
          href={href}
          aria-current={current ? 'page' : undefined}
          className={navItemClassName(current)}
        >
          {content}
        </a>
      ) : (
        <button type="button" onClick={onClick} className={navItemClassName(current)}>
          {content}
        </button>
      )}
    </li>
  );
}

/** The page title: 34/42 px, 51 px above what follows. */
export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="mb-[51px] font-heading text-headline leading-[1.235] [font-weight:var(--font-weight-headline)] max-[760px]:mb-7 max-[760px]:text-[30px]">
      {children}
    </h1>
  );
}

/** A section of a page, 50 px below the previous one, with its title (20/28 px). */
export function PageSection({
  title,
  children,
  first = false,
}: {
  title?: ReactNode;
  children: ReactNode;
  /** The first section sits right under the page title. */
  first?: boolean;
}) {
  const titleId = useId();
  return (
    <section
      className={cx(!first && 'mt-[50px] max-[760px]:mt-9')}
      {...(title ? { 'aria-labelledby': titleId } : {})}
    >
      {title && (
        <h2
          id={titleId}
          className="mb-6 font-heading text-title leading-[1.4] font-semibold max-[760px]:text-[18px]"
        >
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

const gridLayouts = {
  // A featured card over two rows beside four columns of 66 px cards.
  featured:
    'grid-cols-[250px_repeat(4,minmax(0,1fr))] grid-rows-[66px_66px] gap-x-2.5 gap-y-3 max-[1400px]:grid-cols-[1.3fr_repeat(4,1fr)] max-[1100px]:grid-cols-3 max-[1100px]:grid-rows-none max-[760px]:grid-cols-2',
  // A row of wider cards.
  row: 'grid-cols-[repeat(3,254px)] gap-[11px] max-[1400px]:max-w-[784px] max-[1400px]:grid-cols-3 max-[760px]:grid-cols-1',
  // Results of a search or a category.
  list: 'grid-cols-3 gap-3 max-[760px]:grid-cols-1',
} as const;

/** The company's apps, laid out as in the workspace. */
export function AppGrid({
  layout = 'featured',
  label,
  children,
}: {
  layout?: keyof typeof gridLayouts;
  /** The accessible name of the group. */
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('grid', gridLayouts[layout])} {...(label ? { 'aria-label': label } : {})}>
      {children}
    </div>
  );
}

/**
 * An app of the company: its icon and name; featured, over two rows with what it is for. A link
 * with `href`, a button with `onClick`.
 */
export function AppCard({
  href,
  onClick,
  icon,
  name,
  description,
  featured = false,
}: {
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  name: ReactNode;
  description?: ReactNode;
  featured?: boolean;
}) {
  const className = cx(
    'min-w-0 rounded-box border border-line bg-surface text-left font-semibold text-fg',
    'transition-colors duration-150 hover:border-accent hover:bg-surface-raised',
    featured
      ? 'row-span-2 block px-[15px] py-[22px] max-[760px]:col-span-full max-[760px]:row-auto max-[760px]:p-4'
      : 'flex min-h-[66px] items-center gap-5 px-[22px] py-4 max-[1400px]:gap-3 max-[1400px]:p-3.5',
  );
  const iconBox = icon && (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center [&_svg]:size-full',
        featured ? 'h-[35px] w-[34px]' : 'h-8 w-7',
      )}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
  const content = featured ? (
    <>
      <span className="flex items-center gap-[21px] pl-2 max-[760px]:pl-0">
        {iconBox}
        <span className="min-w-0 truncate">{name}</span>
      </span>
      {description && (
        <span className="mt-5 block text-body-sm font-normal max-[760px]:mt-3">{description}</span>
      )}
    </>
  ) : (
    <>
      {iconBox}
      <span className="min-w-0 truncate">{name}</span>
    </>
  );
  return href ? (
    <a href={href} className={className}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function chipClassName(pressed: boolean, className?: string): string {
  return cx(
    'inline-flex h-[43px] items-center gap-1.5 rounded-pill whitespace-nowrap text-fg',
    'transition-colors duration-150 hover:border-accent [&_svg]:size-3.5',
    pressed
      ? 'border-2 border-line-selected bg-surface-selected px-4 font-semibold'
      : 'border border-line-control px-[17px]',
    className,
  );
}

/** A filter pill, such as an app category: pressed or not, said to assistive technology too. */
export function Chip({
  pressed,
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={chipClassName(pressed, className)}
      {...props}
    />
  );
}

/** Filter pills, 12 px apart. */
export function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-3 max-[1100px]:gap-2">
      {children}
    </div>
  );
}

export interface MenuItem {
  label: ReactNode;
  /** A link: opens in a new tab when `external`. */
  href?: string;
  external?: boolean;
  onSelect?: () => void;
}

/**
 * A button that opens a menu: the toolbar's (an outlined button) or a filter's (a pill). Escape
 * and a click outside close it.
 */
export function Menu({
  label,
  items,
  trigger = 'button',
  icon,
}: {
  label: ReactNode;
  items: MenuItem[];
  trigger?: 'button' | 'chip';
  icon?: IconName;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [open]);
  const itemClassName =
    'flex w-full items-center justify-between gap-4 rounded-[3px] p-3 text-left text-fg no-underline hover:bg-surface-selected';
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={
          trigger === 'chip'
            ? chipClassName(false)
            : 'flex h-[33px] items-center gap-2 rounded-control border border-line-control px-3 font-semibold text-fg transition-colors duration-150 hover:bg-surface-hover max-[760px]:text-body-sm [&_svg]:size-5'
        }
      >
        {icon && <Icon name={icon} />}
        {label}
        <span className="inline-flex [&_svg]:size-3">
          <Icon name="chevron" />
        </span>
      </button>
      <div
        id={menuId}
        hidden={!open}
        className="absolute top-[calc(100%+8px)] right-0 z-10 min-w-[220px] rounded-menu border border-line-overlay bg-surface-raised p-1.5 shadow-[0_8px_24px_#0005]"
      >
        {items.map((item, index) =>
          item.href ? (
            <a
              key={index}
              href={item.href}
              {...(item.external ? { target: '_blank', rel: 'noopener' } : {})}
              className={itemClassName}
              onClick={() => setOpen(false)}
            >
              {item.label}
              {item.external && <span aria-hidden="true">↗</span>}
            </a>
          ) : (
            <button
              key={index}
              type="button"
              className={itemClassName}
              onClick={() => {
                setOpen(false);
                item.onSelect?.();
              }}
            >
              {item.label}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

/** The search field of a page: an accent line, a search icon, a close button. */
export function SearchField({
  label,
  closeLabel,
  onClose,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'aria-label'> & {
  /** The field's accessible name. */
  label: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div
      className={cx(
        'flex items-center gap-3 rounded-control border border-accent px-3 py-2 text-fg',
        className,
      )}
    >
      <Icon name="search" />
      <input
        type="search"
        aria-label={label}
        className="w-full border-0 bg-transparent p-1.5 text-fg outline-0 placeholder:text-fg-muted"
        {...props}
      />
      <IconButton label={closeLabel} onClick={onClose}>
        <Icon name="close" />
      </IconButton>
    </div>
  );
}

/** The client's colors, at the bottom of the sidebar: small round swatches and their caption. */
export function Swatches({
  label,
  colors,
}: {
  label: string;
  colors: { value: string; name: string }[];
}) {
  return (
    <div className="flex items-center gap-[5px]" role="group" aria-label={label}>
      {colors.map((color) => (
        <span
          key={color.value}
          className="size-2.5 rounded-full"
          style={{ background: color.value }}
          title={`${color.value} · ${color.name}`}
        />
      ))}
      <small className="ml-1 text-[10px] text-fg-muted">{label}</small>
    </div>
  );
}
