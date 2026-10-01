import { Button, Chip, ChipGroup, Dialog, Tag } from '@kete/design';
import { useId, useState } from 'react';
import { feedbackKinds, type FeedbackInput, type FeedbackKind } from './kinds.js';

export interface FeedbackLabels {
  /** The button that opens it: "Un avis ?". */
  open: string;
  title: string;
  kinds: Record<FeedbackKind, string>;
  kindsLabel: string;
  message: string;
  send: string;
  close: string;
  thanks: string;
  error: string;
}

/**
 * The feedback button of every Kete app: what goes wrong, an idea, or what works, said where it
 * happens. The product sends it (`onSubmit`, for example to `createFeedbackHandler`).
 */
export function FeedbackButton({
  labels,
  onSubmit,
}: {
  labels: FeedbackLabels;
  onSubmit(input: FeedbackInput): Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('problem');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const messageId = useId();

  async function send() {
    setState('sending');
    try {
      await onSubmit({ kind, message: message.trim(), page: window.location.pathname });
      setState('sent');
      setMessage('');
    } catch {
      setState('failed');
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {labels.open}
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setState('idle');
        }}
        title={labels.title}
        closeLabel={labels.close}
      >
        <div className="flex flex-col gap-4">
          <ChipGroup label={labels.kindsLabel}>
            {feedbackKinds.map((choice) => (
              <Chip key={choice} pressed={kind === choice} onClick={() => setKind(choice)}>
                {labels.kinds[choice]}
              </Chip>
            ))}
          </ChipGroup>
          <label htmlFor={messageId} className="text-body-sm font-semibold text-fg">
            {labels.message}
          </label>
          <textarea
            id={messageId}
            value={message}
            maxLength={2000}
            rows={4}
            onChange={(event) => setMessage(event.target.value)}
            className="rounded-control border border-line-strong bg-surface-control p-3 font-ui text-body text-fg"
          />
          <div className="flex justify-end">
            <Button
              disabled={state === 'sending' || message.trim() === ''}
              onClick={() => void send()}
            >
              {labels.send}
            </Button>
          </div>
          {state === 'sent' && <Tag tone="validated">{labels.thanks}</Tag>}
          {state === 'failed' && <Tag tone="error">{labels.error}</Tag>}
        </div>
      </Dialog>
    </>
  );
}
