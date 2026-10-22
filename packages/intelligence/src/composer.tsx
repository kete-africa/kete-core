import { MessageField, type FieldPick, type FieldTrigger } from '@kete/design';
import type { IntelligenceWords } from './panel.js';

// Kete Intelligence's field (kete-core spec 108; spec 140, FR-018): the one composer of
// @kete/design, the same as the threads' — the question, the files joined to it, the objects she
// cites (@) and the gestures she asks (/) picked from the product's lists, her voice written as she
// speaks, « Envoyer » — « Arrêter » while it answers.

/** An object she may cite (@) or a gesture she may ask (/). */
export interface ComposerPick {
  id: string;
  label: string;
  hint?: string;
}

/** What she picked and kept in her question, for the product to tell its model. */
export interface PickedItem {
  kind: 'mention' | 'gesture';
  id: string;
  label: string;
}

/** A file joined to the next question, as the product sends it. */
export interface ComposerFile {
  id: string;
  name: string;
  state: 'sending' | 'ready' | 'failed';
}

/** What the product's field offers beyond the words. */
export interface ComposerOptions {
  attach?: {
    accept?: string;
    files: readonly ComposerFile[];
    onFiles: (files: File[]) => void;
    onRemove: (id: string) => void;
  };
  mentions?: readonly ComposerPick[];
  gestures?: readonly ComposerPick[];
  /** Her voice, written by the browser's speech recognition where it has one. */
  dictate?: { lang?: string };
  /** Words the product puts in the field for her to finish — rows of a table she chose. */
  prefill?: { text: string; at: number };
}

/** The word she is typing after @ or /, before the caret. */
export function typing(
  text: string,
  caret: number,
): { trigger: '@' | '/'; query: string; at: number } | null {
  const found = /(^|\s)([@/])([^\s@/]*)$/.exec(text.slice(0, caret));
  if (!found) return null;
  const trigger = found[2] as '@' | '/';
  return { trigger, query: found[3] ?? '', at: caret - (found[3] ?? '').length - 1 };
}

export function Composer({
  running,
  words,
  onSend,
  onStop,
  options = {},
}: {
  running: boolean;
  words: IntelligenceWords;
  onSend: (question: string, picks: PickedItem[]) => void;
  onStop: () => void;
  options?: ComposerOptions;
}) {
  const triggers: FieldTrigger[] = [
    ...(options.mentions ? (['@'] as const) : []),
    ...(options.gestures ? (['/'] as const) : []),
  ];
  const search = (trigger: FieldTrigger, query: string): FieldPick[] =>
    ((trigger === '@' ? options.mentions : options.gestures) ?? [])
      .filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
      .map((item) => ({
        id: item.id,
        label: item.label,
        ...(item.hint ? { hint: item.hint } : {}),
      }));
  const attach = options.attach;
  return (
    <MessageField
      words={{
        field: words.composer,
        placeholder: words.placeholder,
        send: words.send,
        stop: words.stop,
        add: words.attach,
        attach: words.attach,
        mention: words.cite,
        cite: words.cite,
        gestures: words.gestures,
        emoji: words.cite,
        moreEmoji: words.cite,
        remove: words.close,
        cancelReply: words.close,
        record: words.dictate,
        recording: words.dictate,
        cancelRecording: words.close,
        sendRecording: words.send,
        dictate: words.dictate,
      }}
      busy={running}
      onStop={onStop}
      triggers={triggers}
      search={search}
      {...(attach
        ? {
            files: {
              items: [...attach.files],
              ...(attach.accept ? { accept: attach.accept } : {}),
              onFiles: attach.onFiles,
              onRemove: attach.onRemove,
            },
          }
        : {})}
      {...(options.dictate ? { dictate: options.dictate } : {})}
      {...(options.prefill ? { prefill: options.prefill } : {})}
      onSend={(text, picked) =>
        onSend(
          text,
          picked.map((pick) => ({
            kind: pick.trigger === '@' ? 'mention' : 'gesture',
            id: pick.id,
            label: pick.label,
          })),
        )
      }
    />
  );
}
