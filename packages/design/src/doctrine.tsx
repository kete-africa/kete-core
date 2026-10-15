import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CanvasIcon } from './canvas-icon.js';
import { Button, cx, dialogClassName } from './components.js';

// The doctrine's components, provided to every Kete product (CONCEPTION 12): the verification
// card, the agent states, the confirmation of the irreversible, the notification with undo, the
// empty page. Every word comes from the product's catalogs, through props.

export type AgentStateName = 'prepared' | 'corrected' | 'verified' | 'refused';

const agentMarkers: Record<AgentStateName, string> = {
  // An empty square: prepared by the agent, nobody decided yet.
  prepared: 'border-2 border-fg-muted',
  // A filled square: decided by a person.
  corrected: 'bg-state-info',
  verified: 'bg-state-success',
  refused: 'bg-state-error',
};

/** Where a draft stands: prepared (empty square), or decided by a person (filled square). */
export function AgentState({ state, children }: { state: AgentStateName; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 text-body-sm font-semibold text-fg"
      data-agent-state={state}
    >
      <span className={cx('inline-block size-2.5', agentMarkers[state])} aria-hidden="true" />
      {children}
    </span>
  );
}

export interface VerificationField {
  label: ReactNode;
  value: ReactNode;
  /** Where the value comes from: "from the message", "usual price", "uncertain". */
  provenance: ReactNode;
  /** Filled by the agent and not yet certain: shown to be checked. */
  uncertain?: boolean;
}

/**
 * The signature component (the canvas's verification card): a draft prepared by the agent — its
 * mark, its title, where it stands — each field with its provenance, what is uncertain in the
 * verify color, the gestures that decide it (Valider, Corriger, Refuser), and the lesson a
 * correction becomes. Once decided, `decision` says who and when.
 */
export function VerificationCard({
  title,
  state,
  fields,
  actions,
  decision,
  mark,
  badge,
  lesson,
}: {
  title: ReactNode;
  /** The agent state, with its word. */
  state: { name: AgentStateName; label: ReactNode };
  fields: VerificationField[];
  /** The buttons that decide the draft, when it is still prepared. */
  actions?: ReactNode;
  /** The trace of the decision: who, when. */
  decision?: ReactNode;
  /** Before the title: Kete Intelligence's spark, or what the draft was read from. */
  mark?: ReactNode;
  /** On the right of the head, before the state: « une personne valide ». */
  badge?: ReactNode;
  /** Under the card: what a correction teaches, and who owns it. */
  lesson?: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="overflow-hidden rounded-[5px] border border-line-strong bg-surface text-fg"
    >
      <header className="flex flex-wrap items-center gap-2.5 border-b border-line bg-surface-raised px-3.5 py-2.5">
        {mark}
        <h2 id={titleId} className="m-0 text-body font-semibold">
          {title}
        </h2>
        <span className="ml-auto flex flex-wrap items-center gap-2.5">
          {badge && (
            <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-[5px] bg-surface-selected px-[7px] text-[12px] font-semibold text-fg-soft">
              {badge}
            </span>
          )}
          <AgentState state={state.name}>{state.label}</AgentState>
        </span>
      </header>
      <dl className="m-0 flex flex-col divide-y divide-line">
        {fields.map((field, index) => (
          <div
            key={index}
            className={cx(
              'grid grid-cols-[112px_minmax(0,1fr)] items-start gap-3 px-3.5 py-2.5 text-[13px]',
              field.uncertain && 'bg-state-verify-surface',
            )}
          >
            <dt className={field.uncertain ? 'text-state-verify-fg' : 'text-fg-muted'}>
              {field.label}
            </dt>
            <dd className="m-0 min-w-0 font-semibold">
              {field.value}
              <span
                className={cx(
                  'mt-[3px] flex items-center gap-1.5 text-[12px] font-normal',
                  field.uncertain ? 'text-state-verify-fg' : 'text-fg-muted',
                )}
              >
                {field.uncertain && (
                  <span className="inline-flex shrink-0" aria-hidden="true">
                    <CanvasIcon name="alert" size={12} />
                  </span>
                )}
                {field.provenance}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {(actions || decision) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-control px-3.5 py-3">
          {actions}
          {decision && <p className="m-0 text-body-sm text-fg-muted">{decision}</p>}
        </div>
      )}
      {lesson && (
        <p className="m-0 flex items-start gap-1.5 border-t border-line px-3.5 py-2 text-[12px] leading-[1.5] text-fg-muted">
          <span className="mt-0.5 inline-flex shrink-0" aria-hidden="true">
            <CanvasIcon name="read" size={12} />
          </span>
          <span>{lesson}</span>
        </p>
      )}
    </section>
  );
}

/**
 * The confirmation an irreversible gesture always asks (autonomy level 4): what will happen, and
 * two answers. A modal dialog: Escape cancels.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  /** What exactly will happen, with the count when there is one. */
  children: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
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
        onCancel();
      }}
      className={dialogClassName}
    >
      <h2 id={titleId} className="mb-4 font-heading text-title font-semibold">
        {title}
      </h2>
      <div className="mb-6 text-body leading-[1.6] text-fg-soft">{children}</div>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </dialog>
  );
}

/**
 * What an agent did on its own, reversibly (autonomy level 2): said at once, with the way back.
 * The product decides how long it stays.
 */
export function UndoNotice({
  children,
  undoLabel,
  onUndo,
  placement = 'inline',
}: {
  children: ReactNode;
  undoLabel: ReactNode;
  onUndo: () => void;
  /** In the flow of the page, or floating at the bottom center. */
  placement?: 'inline' | 'bottom';
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        'flex flex-wrap items-center justify-between gap-4 rounded-overlay border border-notice-line bg-notice px-5 py-3 text-body text-on-notice',
        placement === 'bottom' &&
          'fixed bottom-6 left-1/2 z-20 w-max max-w-[calc(100%-32px)] -translate-x-1/2',
      )}
    >
      <span>{children}</span>
      <button
        type="button"
        onClick={onUndo}
        className="font-semibold underline underline-offset-4 hover:no-underline"
      >
        {undoLabel}
      </button>
    </div>
  );
}

/** The seed of an empty page: something will grow here. */
function Seed() {
  return (
    <svg viewBox="0 0 64 64" width={56} height={56} aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={3}>
        <path d="M8 48 H56" />
        <path d="M32 48 C32 36 32 30 32 24" />
        <path d="M32 30 C24 30 19 25 18 17 C26 17 31 22 32 30" />
        <path d="M32 26 C38 26 43 22 44 15 C38 15 33 19 32 26" />
        <path d="M32 48 C30 53 26 56 22 58" />
        <path d="M32 48 C34 53 38 56 42 58" />
      </g>
    </svg>
  );
}

/** An empty page: what will be here, and the gesture that fills it. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-fg">
      <span className="text-fg-muted">
        <Seed />
      </span>
      <p className="mt-2 font-heading text-title font-semibold">{title}</p>
      {children && <div className="max-w-prose text-body text-fg-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
