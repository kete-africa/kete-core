import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

function cx(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** The K whose leg becomes a root. Decorative: pair it with the word "kete" or an accessible name. */
export function KeteMark({ size = 32, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" focusable="false">
      <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
        <path d="M42 12 L42 64" strokeWidth={14} />
        <path d="M42 58 L90 14" strokeWidth={14} />
        <path d="M42 62 C62 66 82 82 94 108" strokeWidth={12} />
        <path d="M42 64 C42 84 30 94 16 108" strokeWidth={10} />
        <path d="M42 66 C44 86 52 96 54 110" strokeWidth={9} />
      </g>
    </svg>
  );
}

/** The kete band: a strip of rectangular blocks. Never behind text. */
export function KeteBand({ height = 8 }: { height?: number }) {
  const blocks: [string, number][] = [
    ['bg-primary', 8],
    ['bg-ochre', 2],
    ['bg-ink', 5],
    ['bg-root', 3],
    ['bg-primary', 6],
    ['bg-ember', 2],
    ['bg-primary', 9],
  ];
  return (
    <div className="flex" style={{ height }} aria-hidden="true">
      {blocks.map(([color, grow], i) => (
        <div key={i} className={color} style={{ flexGrow: grow }} />
      ))}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary';

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
        'inline-flex h-12 items-center justify-center gap-2 rounded-control px-6 font-body font-semibold',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-primary text-sand hover:bg-primary-strong',
        variant === 'secondary' && 'border border-ink bg-paper text-ink hover:bg-clay',
        className,
      )}
      {...props}
    />
  );
}

export type TagTone = 'agent' | 'verify' | 'validated' | 'error' | 'info' | 'neutral';

const tagStyles: Record<TagTone, { box: string; marker?: string }> = {
  agent: { box: 'bg-ink text-sand' },
  verify: { box: 'bg-verify-surface text-verify-ink', marker: 'bg-verify' },
  validated: { box: 'bg-success-surface text-success-ink', marker: 'bg-success' },
  error: { box: 'bg-error-surface text-error-ink', marker: 'bg-error' },
  info: { box: 'bg-info-surface text-info-ink', marker: 'bg-info' },
  neutral: { box: 'bg-clay text-bark' },
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
      <label htmlFor={id} className="text-body-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          'h-[46px] rounded-control border px-3.5 text-body text-ink',
          error
            ? 'border-2 border-error bg-paper'
            : uncertain
              ? 'border-verify bg-verify-surface'
              : 'border-rule-strong bg-paper',
        )}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-2 text-body-sm text-error-ink">
          <span className="inline-block size-2 bg-error" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${id}-hint`}
          className={cx('text-body-sm', uncertain ? 'text-verify-ink' : 'text-bark')}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A panel: paper, a 1 px rule, no radius, a label-caps title. */
export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="border border-rule bg-paper p-6">
      {title && (
        <h2 className="mb-4 font-label-caps text-label-caps uppercase tracking-label-caps text-bark">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
