import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { cx, IconButton } from './components.js';
import { Icon, type IconName } from './workspace.js';

// The slots every page of an enterprise app fills the same way (spec 040): a page header (where
// am I, what is it, its one main action), tabs for an object's facets, a command bar (filters,
// search, the view's format), the content, and a detail pane beside it. A list page and an object
// page are made of these slots only, so that whatever is added opens an interface of the same
// shape, in the same places. Semantic tokens only; every word comes through props.

export interface Crumb {
  label: ReactNode;
  href?: string;
}

/**
 * The page header: the breadcrumb, the title with its status, what it is in one line, and the
 * page's actions — one main action at most, the others secondary.
 */
export function PageHeader({
  breadcrumbLabel,
  breadcrumbs = [],
  title,
  status,
  description,
  actions,
}: {
  /** The accessible name of the breadcrumb. */
  breadcrumbLabel?: string;
  breadcrumbs?: Crumb[];
  title: ReactNode;
  /** A Tag or an AgentState beside the title. */
  status?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-2">
      {breadcrumbs.length > 0 && (
        <nav aria-label={breadcrumbLabel}>
          <ol className="flex flex-wrap items-center gap-1.5 text-body-sm text-fg-muted">
            {breadcrumbs.map((crumb, index) => (
              <li key={index} className="flex items-center gap-1.5">
                {index > 0 && <span aria-hidden="true">›</span>}
                {crumb.href ? (
                  <a href={crumb.href} className="text-fg-muted hover:text-fg hover:underline">
                    {crumb.label}
                  </a>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="font-heading text-[28px] leading-[1.25] [font-weight:var(--font-weight-headline)] max-[760px]:text-[24px]">
            {title}
          </h1>
          {status}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {description && <p className="max-w-3xl text-fg-muted">{description}</p>}
    </header>
  );
}

export interface TabItem {
  key: string;
  label: ReactNode;
  /** A link to the tab's address: tabs of an object are pages that can be shared. */
  href?: string;
  count?: number;
}

/** An object's facets: links (or buttons) under the header, the current one underlined. */
export function Tabs({
  label,
  items,
  current,
  onSelect,
}: {
  label: string;
  items: TabItem[];
  current: string;
  onSelect?: (key: string) => void;
}) {
  const className = (on: boolean) =>
    cx(
      'inline-flex h-10 items-center gap-2 border-b-2 px-1 whitespace-nowrap text-fg transition-colors duration-150',
      on ? 'border-accent font-semibold' : 'border-transparent text-fg-muted hover:text-fg',
    );
  return (
    <nav aria-label={label} className="mb-5 overflow-x-auto border-b border-line">
      <ul className="flex gap-6">
        {items.map((item) => {
          const on = item.key === current;
          const content = (
            <>
              {item.label}
              {item.count !== undefined && (
                <span className="rounded-pill bg-surface-selected px-2 text-body-sm font-normal">
                  {item.count}
                </span>
              )}
            </>
          );
          return (
            <li key={item.key}>
              {item.href ? (
                <a
                  href={item.href}
                  aria-current={on ? 'page' : undefined}
                  className={className(on)}
                >
                  {content}
                </a>
              ) : (
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSelect?.(item.key)}
                  className={className(on)}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The command bar of a list: filters and search on the left, the view's format on the right. */
export function CommandBar({ children, end }: { children?: ReactNode; end?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      {end && <div className="flex items-center gap-2">{end}</div>}
    </div>
  );
}

export interface ViewOption {
  key: string;
  label: string;
  icon?: IconName;
  /** A link: the format is part of the address (`?vue=`), shared and remembered. */
  href?: string;
}

/** The formats of one view — chart, list, table… — as a segmented control. */
export function ViewSwitcher({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ViewOption[];
  value: string;
  onChange?: (key: string) => void;
}) {
  const className = (on: boolean) =>
    cx(
      'inline-flex h-[30px] items-center gap-1.5 rounded-[4px] px-3 text-body-sm whitespace-nowrap text-fg [&_svg]:size-4',
      on ? 'bg-surface-selected font-semibold' : 'hover:bg-surface-hover',
    );
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-control border border-line-control bg-surface-control p-0.5"
    >
      {options.map((option) => {
        const on = option.key === value;
        const content = (
          <>
            {option.icon && <Icon name={option.icon} />}
            {option.label}
          </>
        );
        return option.href ? (
          <a
            key={option.key}
            href={option.href}
            aria-current={on ? 'true' : undefined}
            className={className(on)}
          >
            {content}
          </a>
        ) : (
          <button
            key={option.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange?.(option.key)}
            className={className(on)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

export interface Column<Row> {
  key: string;
  label: ReactNode;
  /** Numbers align right, in tabular figures. */
  align?: 'start' | 'end';
  render?: (row: Row) => ReactNode;
}

/**
 * A dense table: a caption for assistive technology, sticky headers, bordered rows; a row opens
 * its object with `rowHref` or `onRowClick` (its first cell is then the link).
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  rowHref,
  onRowClick,
  selected,
  empty,
}: {
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  rowHref?: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  /** The key of the row shown in the detail pane. */
  selected?: string | null;
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const cell = (row: Row, column: Column<Row>) =>
    column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '');
  return (
    <div className="overflow-x-auto rounded-box border border-line">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(
                  'border-b border-line px-3 py-2 text-body-sm font-semibold text-fg-muted',
                  column.align === 'end' && 'text-right',
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const clickable = Boolean(rowHref || onRowClick);
            return (
              <tr
                key={key}
                aria-selected={selected === key ? true : undefined}
                className={cx(
                  'border-b border-line last:border-b-0',
                  clickable && 'hover:bg-surface-hover',
                  selected === key && 'bg-surface-selected',
                )}
              >
                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    className={cx(
                      'px-3 py-2 align-top',
                      column.align === 'end' && 'font-number text-right',
                    )}
                  >
                    {index === 0 && rowHref ? (
                      <a href={rowHref(row)} className="font-semibold text-fg hover:underline">
                        {cell(row, column)}
                      </a>
                    ) : index === 0 && onRowClick ? (
                      <button
                        type="button"
                        onClick={() => onRowClick(row)}
                        className="text-left font-semibold text-fg hover:underline"
                      >
                        {cell(row, column)}
                      </button>
                    ) : (
                      cell(row, column)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The dialog where a short form opens (an addition, a quick change; six fields at most): on the
 * right when the screen is wide (above 1100 px), the list still visible behind it; centered
 * otherwise. A longer form has its own page (`FormPage`). Escape and a click on the backdrop close
 * it; its footer holds the form's buttons.
 */
export function Drawer({
  open,
  onClose,
  title,
  closeLabel,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  closeLabel: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cx(
        'flex-col bg-surface p-0 text-fg backdrop:bg-black/50 open:flex',
        // Wide screens: a panel on the right, the page visible beside it.
        'min-[1101px]:fixed min-[1101px]:inset-y-0 min-[1101px]:right-0 min-[1101px]:left-auto',
        'min-[1101px]:m-0 min-[1101px]:h-dvh min-[1101px]:max-h-dvh min-[1101px]:w-[440px]',
        'min-[1101px]:border-l min-[1101px]:border-line-overlay',
        // Narrower: a centered dialog, its height following its content.
        'max-[1100px]:m-auto max-[1100px]:max-h-[85dvh] max-[1100px]:w-[calc(100%-32px)]',
        'max-[1100px]:max-w-[520px] max-[1100px]:rounded-overlay max-[1100px]:border',
        'max-[1100px]:border-line-overlay',
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
        <h2 id={titleId} className="font-heading text-title font-semibold">
          {title}
        </h2>
        <IconButton label={closeLabel} onClick={onClose}>
          <Icon name="close" />
        </IconButton>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer && (
        <footer className="flex flex-wrap gap-2 border-t border-line px-6 py-4">{footer}</footer>
      )}
    </dialog>
  );
}

/** The content beside its detail pane; under 1100 px the pane goes below. */
export function SplitView({ children, detail }: { children: ReactNode; detail?: ReactNode }) {
  return (
    <div
      className={cx(
        'grid gap-5',
        Boolean(detail) && 'min-[1101px]:grid-cols-[minmax(0,1fr)_340px] min-[1101px]:items-start',
      )}
    >
      <div className="min-w-0">{children}</div>
      {detail}
    </div>
  );
}

/** The detail of the selected item, beside the content: what it is, its facts, its links. */
export function DetailPane({
  title,
  subtitle,
  closeLabel,
  onClose,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  closeLabel?: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <aside
      aria-labelledby={titleId}
      className="rounded-box border border-line bg-surface p-5 min-[1101px]:sticky min-[1101px]:top-4"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="font-heading text-title font-semibold">
            {title}
          </h2>
          {subtitle && <p className="text-body-sm text-fg-muted">{subtitle}</p>}
        </div>
        {onClose && closeLabel && (
          <IconButton label={closeLabel} onClick={onClose}>
            <Icon name="close" />
          </IconButton>
        )}
      </header>
      {children}
    </aside>
  );
}

/** Facts of an object, label above value. */
export function Facts({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-3">
      {items.map((item, index) => (
        <div key={index}>
          <dt className="text-body-sm text-fg-muted">{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A figure at a glance: its label, its value in tabular figures, a line of context. */
export function KpiTile({
  label,
  value,
  hint,
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <span className="text-body-sm text-fg-muted">{label}</span>
      <span className="font-number text-[26px] leading-tight font-semibold">{value}</span>
      {hint && <span className="text-body-sm text-fg-muted">{hint}</span>}
    </>
  );
  const className =
    'flex min-w-0 flex-col gap-1 rounded-box border border-line bg-surface px-4 py-3 text-fg';
  return href ? (
    <a href={href} className={cx(className, 'hover:border-accent hover:bg-surface-raised')}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

/** Figures side by side: four columns, two on a phone. */
export function KpiGrid({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div
      className="mb-6 grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2"
      {...(label ? { role: 'group', 'aria-label': label } : {})}
    >
      {children}
    </div>
  );
}

export interface ChartNode {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** A Tag: vacant, acting… */
  badge?: ReactNode;
  children?: ChartNode[];
}

/**
 * An organization chart: boxes and their links, top-down, scrolled sideways when wide. A box with
 * children folds and unfolds them; the first `openDepth` levels start unfolded. Selecting a box
 * calls `onSelect` (the page shows it in its detail pane).
 */
export function OrgChart({
  label,
  root,
  selected,
  onSelect,
  openDepth = 2,
  foldLabel,
  unfoldLabel,
}: {
  label: string;
  root: ChartNode[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  openDepth?: number;
  /** Names of the fold buttons, with the box's title appended by the reader. */
  foldLabel: string;
  unfoldLabel: string;
}) {
  return (
    <div role="tree" aria-label={label} className="kete-orgchart overflow-x-auto pb-4">
      <ul>
        {root.map((node) => (
          <ChartBranch
            key={node.id}
            node={node}
            depth={0}
            openDepth={openDepth}
            selected={selected ?? null}
            onSelect={onSelect}
            foldLabel={foldLabel}
            unfoldLabel={unfoldLabel}
          />
        ))}
      </ul>
    </div>
  );
}

function ChartBranch({
  node,
  depth,
  openDepth,
  selected,
  onSelect,
  foldLabel,
  unfoldLabel,
}: {
  node: ChartNode;
  depth: number;
  openDepth: number;
  selected: string | null;
  onSelect: ((id: string) => void) | undefined;
  foldLabel: string;
  unfoldLabel: string;
}) {
  const children = node.children ?? [];
  const [open, setOpen] = useState(depth < openDepth - 1);
  const onKey = (event: ReactKeyboardEvent) => {
    if (event.key === 'ArrowRight' && !open && children.length) setOpen(true);
    if (event.key === 'ArrowLeft' && open) setOpen(false);
  };
  return (
    <li
      role="treeitem"
      aria-expanded={children.length ? open : undefined}
      aria-selected={selected === node.id}
    >
      <div
        className={cx(
          'kete-orgchart-box relative inline-flex min-w-[150px] max-w-[210px] flex-col items-center gap-0.5 rounded-box border bg-surface px-3 py-2 text-center',
          selected === node.id ? 'border-2 border-accent' : 'border-line',
        )}
      >
        <button
          type="button"
          onClick={() => onSelect?.(node.id)}
          onKeyDown={onKey}
          className="flex flex-col items-center gap-0.5 text-fg"
        >
          <span className="text-body-sm leading-tight font-semibold">{node.title}</span>
          {node.subtitle && (
            <span className="text-body-sm leading-tight text-fg-muted">{node.subtitle}</span>
          )}
        </button>
        {node.badge}
        {children.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? foldLabel : unfoldLabel}
            className="absolute -bottom-2.5 left-1/2 z-[1] flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-pill border border-line-control bg-surface-control px-1 text-[11px] text-fg hover:bg-surface-hover"
          >
            {open ? '−' : children.length}
          </button>
        )}
      </div>
      {open && children.length > 0 && (
        <ul role="group">
          {children.map((child) => (
            <ChartBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              openDepth={openDepth}
              selected={selected}
              onSelect={onSelect}
              foldLabel={foldLabel}
              unfoldLabel={unfoldLabel}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Rows of a list: bordered rows (dense lists are rows, not cards), each one a link. */
export function RowList({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ul
      className="divide-y divide-line overflow-hidden rounded-box border border-line"
      {...(label ? { 'aria-label': label } : {})}
    >
      {children}
    </ul>
  );
}

export function Row({
  href,
  onClick,
  title,
  meta,
  end,
}: {
  href?: string;
  onClick?: () => void;
  title: ReactNode;
  meta?: ReactNode;
  end?: ReactNode;
}) {
  const content = (
    <>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold">{title}</span>
        {meta && <span className="truncate text-body-sm text-fg-muted">{meta}</span>}
      </span>
      {end && <span className="flex shrink-0 items-center gap-2">{end}</span>}
    </>
  );
  const className =
    'flex w-full items-center justify-between gap-4 bg-surface px-4 py-3 text-left text-fg';
  return (
    <li>
      {href ? (
        <a href={href} className={cx(className, 'hover:bg-surface-hover')}>
          {content}
        </a>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cx(className, 'hover:bg-surface-hover')}>
          {content}
        </button>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  );
}

/**
 * A long form on its own page (spec 044): the header with the way back, sections of fields, and
 * its buttons pinned at the bottom. A form never shares its page with a list.
 */
export function FormPage({
  breadcrumbLabel,
  breadcrumbs,
  title,
  description,
  onSubmit,
  actions,
  children,
}: {
  breadcrumbLabel?: string;
  breadcrumbs: Crumb[];
  title: ReactNode;
  description?: ReactNode;
  onSubmit: () => void;
  /** The form's buttons: one main action (type submit), the others secondary. */
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={title}
        {...(breadcrumbLabel ? { breadcrumbLabel } : {})}
        {...(description ? { description } : {})}
      />
      <form
        noValidate
        className="flex flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
        <div className="sticky bottom-0 -mx-1 flex flex-wrap gap-2 border-t border-line bg-canvas px-1 py-4">
          {actions}
        </div>
      </form>
    </div>
  );
}

/** A group of fields of a form page, with its title and what it is for. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="grid gap-4">
      <div>
        <h2 id={titleId} className="font-heading text-title font-semibold">
          {title}
        </h2>
        {description && <p className="text-body-sm text-fg-muted">{description}</p>}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

/**
 * The person's choice of mode: dark, light or the device's own, as a group of three buttons. The
 * page applies it (`applyTheme`) and remembers it in a cookie the server reads.
 */
export function ThemeChoice({
  label,
  value,
  onChange,
  labels,
}: {
  label: string;
  value: 'dark' | 'light' | 'auto';
  onChange: (choice: 'dark' | 'light' | 'auto') => void;
  labels: { dark: string; light: string; auto: string };
}) {
  return (
    <ViewSwitcher
      label={label}
      value={value}
      onChange={(key) => onChange(key as 'dark' | 'light' | 'auto')}
      options={[
        { key: 'dark', label: labels.dark },
        { key: 'light', label: labels.light },
        { key: 'auto', label: labels.auto },
      ]}
    />
  );
}
