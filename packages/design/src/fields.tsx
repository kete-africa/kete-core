import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cx } from './components.js';

// The form pieces every app needed beside TextField (spec 093): a choice in a list, a tick, one
// choice among a few, a few lines of text, and the notes said under a form. Semantic tokens only,
// shaped like TextField: a label above, a hint or an error below, 44 px to reach with a thumb.

function Below({ id, hint, error }: { id: string; hint?: ReactNode; error?: ReactNode }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="flex items-center gap-2 text-body-sm text-state-error-fg">
        <span className="inline-block size-2 bg-state-error" aria-hidden="true" />
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={`${id}-hint`} className="text-body-sm text-fg-muted">
      {hint}
    </p>
  ) : null;
}

const describedBy = (id: string, hint?: ReactNode, error?: ReactNode) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

/** A choice in a list, labelled like a TextField. */
export function SelectField({
  label,
  hint,
  error,
  options,
  className,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label: string;
  hint?: string;
  error?: string;
  options: readonly { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-body-sm font-semibold text-fg">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cx(
          'h-(--control-height) rounded-control border bg-surface-control px-3 font-ui text-body text-fg',
          error ? 'border-2 border-state-error' : 'border-line-strong',
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Below id={id} hint={hint} error={error} />
    </div>
  );
}

/** A tick with its label, 44 px high at least. */
export function CheckField({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={cx('flex min-h-11 items-start gap-3 py-2', disabled && 'opacity-60')}>
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 accent-(--color-action)"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-fg">{label}</span>
        {hint && <span className="block text-body-sm text-fg-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** One choice among a few, each with what it means: a group of radios. */
export function ChoiceField<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly { value: Value; label: string; hint?: string }[];
  onChange: (value: Value) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-body-sm font-semibold text-fg">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={cx(
            'flex min-h-11 cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5',
            option.value === value
              ? 'border-line-selected bg-surface-selected'
              : 'border-line-control bg-surface-control hover:bg-surface-hover',
          )}
        >
          <input
            type="radio"
            name={name}
            className="mt-0.5 size-5 shrink-0 accent-(--color-action)"
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span className="min-w-0">
            <span className="block font-semibold text-fg">{option.label}</span>
            {option.hint && <span className="block text-body-sm text-fg-muted">{option.hint}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** A few lines of text, labelled like a TextField. */
export function TextAreaField({
  label,
  hint,
  error,
  value,
  rows = 4,
  maxLength,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  error?: string;
  value: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body-sm font-semibold text-fg">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cx(
          'rounded-control border bg-surface-control px-3.5 py-2.5 font-ui text-body text-fg',
          error ? 'border-2 border-state-error' : 'border-line-strong',
        )}
      />
      <Below id={id} hint={hint} error={error} />
    </div>
  );
}

/** What stopped a gesture, said under its form; announced to assistive technology. */
export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-control border border-state-error bg-state-error-surface px-3 py-2 text-body-sm text-state-error-fg"
    >
      <span className="mt-1.5 inline-block size-2 shrink-0 bg-state-error" aria-hidden="true" />
      {children}
    </p>
  );
}

/** Something to know before acting: a missing price, a business not yet set up. */
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-control border border-state-info bg-state-info-surface px-3 py-2 text-body-sm text-state-info-fg">
      {children}
    </p>
  );
}
