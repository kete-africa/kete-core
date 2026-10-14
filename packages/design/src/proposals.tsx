import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, cx } from './components.js';

// What an agent proposes, decided by one gesture (kete-core spec 104; doctrine D-051), and the
// voice she says it with: a list of proposals she ticks, applies together and undoes together; a
// button that records what she says. Every word comes through props.

export type ProposalOutcomeState =
  'applied' | 'failed' | 'needs_confirmation' | 'not_ticked' | 'undone' | 'undo_failed';

export interface ProposalRow {
  key: string;
  label: ReactNode;
  /** Why it is proposed: her own words, often. */
  reason?: ReactNode;
  /** The autonomy level of the gesture that applies it. */
  level: 1 | 2 | 3 | 4;
  ticked: boolean;
  /** What became of it, once she decided. */
  outcome?: ProposalOutcomeState;
}

export interface ProposalWords {
  /** The list's name: « Ce que je propose pour ce soir ». */
  label: string;
  /** « Appliquer 3 gestes ». */
  apply: (count: number) => string;
  dismiss: string;
  undo: string;
  /** « Niveau 2 · réversible ». */
  level: (level: 1 | 2 | 3 | 4) => string;
  /** The words of each outcome: « fait », « à confirmer à part »… */
  outcomes: Record<ProposalOutcomeState, string>;
}

const outcomeTone: Record<ProposalOutcomeState, string> = {
  applied: 'text-state-success-fg',
  failed: 'text-state-error-fg',
  needs_confirmation: 'text-state-verify-fg',
  not_ticked: 'text-fg-muted',
  undone: 'text-fg-muted',
  undo_failed: 'text-state-error-fg',
};

/**
 * A set of proposals (doctrine D-051): each ticked or not — up to level 2 they come ticked — applied
 * together by one gesture and undone together. An irreversible one (level 4) asks its own
 * confirmation afterwards.
 */
export function ProposalList({
  rows,
  status,
  words,
  onToggle,
  onApply,
  onDismiss,
  onUndo,
  busy = false,
}: {
  rows: ProposalRow[];
  status: 'proposed' | 'applied' | 'dismissed' | 'undone';
  words: ProposalWords;
  onToggle: (key: string) => void;
  onApply: () => void;
  onDismiss: () => void;
  onUndo?: () => void;
  busy?: boolean;
}) {
  const id = useId();
  const ticked = rows.filter((row) => row.ticked).length;
  const open = status === 'proposed';
  return (
    <section aria-label={words.label} data-proposals={status} className="flex flex-col gap-3">
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((row) => (
          <li key={row.key} className="flex gap-3 border-b border-line py-2.5 last:border-0">
            <input
              id={`${id}-${row.key}`}
              type="checkbox"
              className="mt-1 size-4 shrink-0 accent-[var(--color-action)]"
              checked={row.ticked}
              disabled={!open || busy}
              onChange={() => onToggle(row.key)}
            />
            <label htmlFor={`${id}-${row.key}`} className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body text-fg">{row.label}</span>
              {row.reason && <span className="text-body-sm text-fg-muted">{row.reason}</span>}
              <span className="text-body-sm text-fg-muted">
                {words.level(row.level)}
                {row.outcome && (
                  <>
                    {' · '}
                    <span data-outcome={row.outcome} className={outcomeTone[row.outcome]}>
                      {words.outcomes[row.outcome]}
                    </span>
                  </>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {open && (
          <>
            <Button onClick={onApply} disabled={busy || ticked === 0}>
              {words.apply(ticked)}
            </Button>
            <Button variant="secondary" onClick={onDismiss} disabled={busy}>
              {words.dismiss}
            </Button>
          </>
        )}
        {status === 'applied' && onUndo && (
          <Button variant="secondary" onClick={onUndo} disabled={busy}>
            {words.undo}
          </Button>
        )}
      </div>
    </section>
  );
}

export interface VoiceWords {
  /** « Dire ma journée ». */
  start: string;
  /** « Terminer ». */
  stop: string;
  /** « J'écoute… 0:12 ». */
  recording: (seconds: number) => string;
  /** The microphone was refused, or there is none: « Le micro n'est pas disponible ». */
  unavailable: string;
}

/**
 * What she says, recorded in her browser (doctrine D-054): one press to start, one to finish — or
 * `maxSeconds` — then `onAudio` receives the recording, for the app's dictation port. Nothing
 * records before she presses.
 */
export function VoiceCapture({
  onAudio,
  words,
  maxSeconds = 180,
  disabled = false,
}: {
  onAudio: (audio: Blob, seconds: number) => void;
  words: VoiceWords;
  maxSeconds?: number;
  disabled?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'unavailable'>('idle');
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const started = useRef(0);

  useEffect(() => {
    if (state !== 'recording') return;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started.current) / 1000);
      setSeconds(elapsed);
      if (elapsed >= maxSeconds) recorder.current?.stop();
    }, 250);
    return () => clearInterval(timer);
  }, [state, maxSeconds]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const next = new MediaRecorder(stream);
      next.ondataavailable = (event) => chunks.push(event.data);
      next.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setState('idle');
        onAudio(
          new Blob(chunks, { type: next.mimeType }),
          Math.round((Date.now() - started.current) / 1000),
        );
      };
      recorder.current = next;
      started.current = Date.now();
      setSeconds(0);
      next.start();
      setState('recording');
    } catch {
      setState('unavailable');
    }
  }

  const recording = state === 'recording';
  return (
    <div className="flex flex-wrap items-center gap-3" data-voice={state}>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={recording}
        onClick={() => (recording ? recorder.current?.stop() : void start())}
        className={cx(
          'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-body font-semibold disabled:opacity-50',
          recording
            ? 'border-state-error bg-state-error-surface text-state-error-fg'
            : 'border-line-control bg-surface-control text-fg hover:border-accent',
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'inline-block size-2.5 rounded-full',
            recording ? 'bg-state-error motion-safe:animate-pulse' : 'bg-accent',
          )}
        />
        {recording ? words.stop : words.start}
      </button>
      <span role="status" className="text-body-sm text-fg-muted">
        {recording ? words.recording(seconds) : state === 'unavailable' ? words.unavailable : ''}
      </span>
    </div>
  );
}
