import {
  Button,
  ErrorNote,
  Panel,
  ProposalList,
  TextAreaField,
  VoiceCapture,
  type ProposalWords,
} from '@kete/design';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  decideMyDay,
  dictateMyDay,
  dismissMyDay,
  fetchClosure,
  understandMyDay,
  undoMyDay,
  type ScreenSet,
} from '@/features/closure/functions';
import { AppShell } from '@/lib/shell';
import { requirePerson } from '@/lib/signed-in';
import * as m from '@/paraglide/messages.js';

// The evening's closure (kete-core spec 104; doctrine D-051): she writes or says her day; what the
// assistant proposes on her tasks, she ticks, applies together, and may undo together.
export const Route = createFileRoute('/soir')({
  beforeLoad: ({ location }) => requirePerson(location.href),
  loader: () => fetchClosure(),
  component: ClosurePage,
});

const words = (): ProposalWords => ({
  label: m.closure_proposals_label(),
  apply: (count) => m.closure_apply({ count: String(count) }),
  dismiss: m.closure_dismiss(),
  undo: m.closure_undo(),
  level: (level) => m.closure_level({ level: String(level) }),
  outcomes: {
    applied: m.closure_outcome_applied(),
    failed: m.closure_outcome_failed(),
    needs_confirmation: m.closure_outcome_confirm(),
    not_ticked: m.closure_outcome_left(),
    undone: m.closure_outcome_undone(),
    undo_failed: m.closure_outcome_undo_failed(),
  },
});

async function base64Of(audio: Blob): Promise<string> {
  const bytes = new Uint8Array(await audio.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function ClosurePage() {
  const { voice } = Route.useLoaderData();
  const [note, setNote] = useState('');
  const [set, setSet] = useState<ScreenSet | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const show = (next: ScreenSet | null) => {
    if (!next) return setSaid(m.errors_generic());
    setSet(next);
    setTicked(next.items.filter((item) => item.ticked).map((item) => item.key));
  };

  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } catch {
      setSaid(m.errors_generic());
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="flex max-w-[720px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-headline font-semibold">{m.closure_title()}</h1>
          <p className="text-body text-fg-muted">{m.closure_intro()}</p>
        </div>
        <Panel>
          <div className="flex flex-col gap-4">
            <TextAreaField
              label={m.closure_note_label()}
              hint={m.closure_note_hint()}
              value={note}
              rows={5}
              maxLength={4000}
              onChange={setNote}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={busy || !note.trim()}
                onClick={() =>
                  void run(async () => {
                    const understood = await understandMyDay({ data: { text: note } });
                    if (understood.status === 'not_connected')
                      return setSaid(m.ask_not_connected());
                    const unclear = understood.unclear.length
                      ? m.closure_unclear({ parts: understood.unclear.join(' · ') })
                      : null;
                    if (understood.status === 'nothing')
                      return setSaid(unclear ?? m.closure_nothing());
                    setSaid(unclear);
                    show(understood.set);
                  })
                }
              >
                {m.closure_understand()}
              </Button>
              {voice && (
                <VoiceCapture
                  disabled={busy}
                  words={{
                    start: m.closure_voice_start(),
                    stop: m.closure_voice_stop(),
                    recording: (seconds) => m.closure_voice_recording({ seconds: String(seconds) }),
                    unavailable: m.closure_voice_unavailable(),
                  }}
                  onAudio={(audio) =>
                    void run(async () => {
                      const heard = await dictateMyDay({ data: { audio: await base64Of(audio) } });
                      if (heard.status === 'heard')
                        setNote((before) => `${before} ${heard.text}`.trim());
                      else
                        setSaid(
                          heard.status === 'silent'
                            ? m.closure_voice_silent()
                            : m.ask_not_connected(),
                        );
                    })
                  }
                />
              )}
            </div>
            <ErrorNote>{said}</ErrorNote>
          </div>
        </Panel>
        {set && (
          <Panel title={m.closure_proposals_label()}>
            <ProposalList
              busy={busy}
              status={set.status}
              words={words()}
              rows={set.items.map((item) => ({
                key: item.key,
                label: item.label,
                ...(item.reason ? { reason: item.reason } : {}),
                level: item.level,
                ticked: set.status === 'proposed' ? ticked.includes(item.key) : item.ticked,
                ...(set.outcomes[item.key] ? { outcome: set.outcomes[item.key] } : {}),
              }))}
              onToggle={(key) =>
                setTicked((list) =>
                  list.includes(key) ? list.filter((k) => k !== key) : [...list, key],
                )
              }
              onApply={() =>
                void run(async () => show(await decideMyDay({ data: { id: set.id, ticked } })))
              }
              onDismiss={() =>
                void run(async () => show(await dismissMyDay({ data: { id: set.id } })))
              }
              onUndo={() => void run(async () => show(await undoMyDay({ data: { id: set.id } })))}
            />
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
