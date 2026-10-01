import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

// Every component uses semantic tokens only (src/semantic.ts): the same code wears the `kete` and
// the `workspace` designs, both modes, and a client's brand.

export function cx(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Small section labels: spaced capitals in `kete`, sentence case in `workspace`. */
export const labelClassName =
  'font-heading text-label-caps [text-transform:var(--label-transform)] tracking-(--label-tracking) text-fg-muted';

type ButtonVariant = 'primary' | 'secondary';

/**
 * Primary: the action's fill. Secondary: outlined, on the control surface (in `workspace`, the
 * toolbar's buttons).
 */
export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex h-(--control-height) items-center justify-center gap-2 rounded-control px-(--control-padding) font-ui font-semibold whitespace-nowrap',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-action text-on-action hover:bg-action-strong',
        variant === 'secondary' &&
          'border border-line-control bg-surface-control text-fg hover:bg-surface-hover',
        className,
      )}
      {...props}
    />
  );
}

/** A button that holds only an icon: its name is said to assistive technology. */
export function IconButton({
  label,
  children,
  className,
  type = 'button',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  /** What it does, for those who do not see the icon. */
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-(--icon-button-size) shrink-0 items-center justify-center rounded-control p-1 text-fg',
        'transition-colors duration-150 hover:bg-surface-hover [&_svg]:size-[18px]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export type TagTone = 'agent' | 'verify' | 'validated' | 'error' | 'info' | 'neutral';

const tagStyles: Record<TagTone, { box: string; marker?: string }> = {
  agent: { box: 'bg-agent text-on-agent' },
  verify: { box: 'bg-state-verify-surface text-state-verify-fg', marker: 'bg-state-verify' },
  validated: {
    box: 'bg-state-success-surface text-state-success-fg',
    marker: 'bg-state-success',
  },
  error: { box: 'bg-state-error-surface text-state-error-fg', marker: 'bg-state-error' },
  info: { box: 'bg-state-info-surface text-state-info-fg', marker: 'bg-state-info' },
  neutral: { box: 'bg-surface-selected text-fg-soft' },
};

/** A state tag: a word, and a square marker so it reads without color. */
export function Tag({ tone = 'neutral', children }: { tone?: TagTone; children: ReactNode }) {
  const style = tagStyles[tone];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-body-sm font-semibold',
        style.box,
      )}
    >
      {style.marker && (
        <span className={cx('inline-block size-2', style.marker)} aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

export function TextField({
  label,
  hint,
  error,
  uncertain = false,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Help, or where an agent-filled value comes from. */
  hint?: string;
  error?: string;
  /** Filled by the agent and not yet certain. */
  uncertain?: boolean;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-body-sm font-semibold text-fg">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          'h-(--control-height) rounded-control border px-3.5 font-ui text-body text-fg',
          error
            ? 'border-2 border-state-error bg-surface-control'
            : uncertain
              ? 'border-state-verify bg-state-verify-surface'
              : 'border-line-strong bg-surface-control',
        )}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-2 text-body-sm text-state-error-fg">
          <span className="inline-block size-2 bg-state-error" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${id}-hint`}
          className={cx('text-body-sm', uncertain ? 'text-state-verify-fg' : 'text-fg-muted')}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A panel: a surface, a 1 px line, the design's corners, a small label for title. */
export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-box border border-line bg-surface p-6 text-fg">
      {title && <h2 className={cx('mb-4', labelClassName)}>{title}</h2>}
      {children}
    </section>
  );
}

/** Dialogs: the overlay's corners and line, 440 px at most, 32 px inside, a darkened page. */
export const dialogClassName =
  'm-auto w-[calc(100%-32px)] max-w-[440px] rounded-overlay border border-line-overlay bg-surface p-8 text-fg backdrop:bg-black/60';

/**
 * A modal dialog: a title, its content, a close button in its corner. Escape and a click outside
 * close it.
 */
export function Dialog({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** The name of the close button. */
  closeLabel: string;
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
      className={dialogClassName}
    >
      <IconButton label={closeLabel} onClick={onClose} className="absolute top-3 right-3">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth={1.6} />
        </svg>
      </IconButton>
      <h2 id={titleId} className="my-4 font-heading text-title font-semibold">
        {title}
      </h2>
      <div className="text-body leading-[1.6] text-fg-soft">{children}</div>
    </dialog>
  );
}
