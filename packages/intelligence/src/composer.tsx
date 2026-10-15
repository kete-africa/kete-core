import { CanvasIcon, type CanvasIconName } from '@kete/design';
import { useEffect, useId, useRef, useState } from 'react';
import type { IntelligenceWords } from './panel.js';

// Kete Intelligence's field (kete-core spec 108; the validated canvas v3.1): the question, the files
// joined to it, the objects she cites (@) and the gestures she asks (/) picked from the product's
// lists, her voice written as she speaks, « Envoyer » — « Arrêter » while it answers.

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
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function speechRecognition(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const triggers = { '@': 'mention', '/': 'gesture' } as const;

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
  const [question, setQuestion] = useState('');
  const [picks, setPicks] = useState<PickedItem[]>([]);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [closed, setClosed] = useState(false);
  const [listening, setListening] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const recognition = useRef<Recognition | null>(null);
  const listId = useId();
  const [Speech, setSpeech] = useState<(new () => Recognition) | null>(null);
  useEffect(() => setSpeech(() => speechRecognition()), []);
  useEffect(() => () => recognition.current?.stop(), []);

  const word = closed ? null : typing(question, caret);
  const list =
    word && (word.trigger === '@' ? options.mentions : options.gestures)
      ? (word.trigger === '@' ? (options.mentions ?? []) : (options.gestures ?? []))
          .filter((item) => item.label.toLowerCase().includes(word.query.toLowerCase()))
          .slice(0, 8)
      : [];
  const open = list.length > 0;

  const send = () => {
    const asked = question.trim();
    if (!asked || running) return;
    const kept = picks.filter((pick) =>
      asked.includes(`${pick.kind === 'mention' ? '@' : '/'}${pick.label}`),
    );
    onSend(asked, kept);
    setQuestion('');
    setPicks([]);
  };
  const choose = (item: ComposerPick) => {
    if (!word) return;
    const kind = triggers[word.trigger];
    const before = question.slice(0, word.at);
    const after = question.slice(caret);
    const inserted = `${word.trigger}${item.label} `;
    setQuestion(before + inserted + after);
    setPicks((list) => [...list, { kind, id: item.id, label: item.label }]);
    const place = before.length + inserted.length;
    setCaret(place);
    setActive(0);
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(place, place);
    });
  };
  const insert = (trigger: '@' | '/') => {
    const text = field.current;
    const at = text?.selectionStart ?? question.length;
    const glue = at > 0 && !/\s/.test(question[at - 1] ?? '') ? ' ' : '';
    const next = question.slice(0, at) + glue + trigger + question.slice(at);
    const place = at + glue.length + 1;
    setQuestion(next);
    setCaret(place);
    setClosed(false);
    setActive(0);
    requestAnimationFrame(() => {
      text?.focus();
      text?.setSelectionRange(place, place);
    });
  };
  const dictate = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    if (!Speech) return;
    const listener = new Speech();
    listener.lang =
      options.dictate?.lang ??
      (typeof document !== 'undefined' ? document.documentElement.lang : '') ??
      '';
    listener.interimResults = false;
    listener.continuous = false;
    listener.onresult = (event) => {
      const said = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (said) setQuestion((text) => (text.trim() ? `${text.trimEnd()} ${said}` : said));
    };
    listener.onend = () => setListening(false);
    listener.onerror = () => setListening(false);
    recognition.current = listener;
    setListening(true);
    listener.start();
  };

  const tool = (label: string, icon: CanvasIconName, onClick: () => void, pressed?: boolean) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      {...(pressed !== undefined ? { 'aria-pressed': pressed } : {})}
      className="inline-grid size-8 place-items-center rounded-[5px] text-fg-soft hover:bg-surface-hover hover:text-fg aria-pressed:bg-agent aria-pressed:text-on-agent"
    >
      <CanvasIcon name={icon} />
    </button>
  );
  const files = options.attach?.files ?? [];

  return (
    <form
      aria-label={words.composer}
      onSubmit={(event) => {
        event.preventDefault();
        if (running) onStop();
        else send();
      }}
      className="relative rounded-[7px] border border-line-strong bg-surface-control pb-1.5 pl-3 pr-2 pt-2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-focus"
    >
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={word?.trigger === '@' ? words.cite : words.gestures}
          className="absolute bottom-full left-0 right-0 z-10 mb-1.5 max-h-64 list-none overflow-auto rounded-[5px] border border-line-overlay bg-surface-raised p-1 shadow-[0_8px_24px_#0003]"
        >
          {list.map((item, index) => (
            <li
              key={item.id}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(item);
              }}
              className="flex cursor-pointer items-baseline gap-2 rounded-[4px] px-2.5 py-1.5 text-[13px] aria-selected:bg-surface-selected"
            >
              <span className="font-semibold">
                {word?.trigger}
                {item.label}
              </span>
              {item.hint && <span className="truncate text-[12px] text-fg-muted">{item.hint}</span>}
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="mb-1.5 flex list-none flex-wrap gap-1.5 p-0">
          {files.map((file) => (
            <li
              key={file.id}
              data-file={file.state}
              className="inline-flex h-[26px] max-w-full items-center gap-1.5 rounded-[5px] bg-surface-selected pl-2 pr-1 text-[12px] text-fg data-[file=failed]:bg-state-error-surface data-[file=failed]:text-state-error-fg data-[file=sending]:text-fg-muted"
            >
              <CanvasIcon name="clip" size={14} />
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                aria-label={`${words.close} · ${file.name}`}
                onClick={() => options.attach?.onRemove(file.id)}
                className="grid size-5 place-items-center rounded-[4px] text-fg-muted hover:bg-surface-hover hover:text-fg"
              >
                <CanvasIcon name="x" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={field}
        aria-label={words.composer}
        rows={2}
        value={question}
        placeholder={words.placeholder}
        {...(open
          ? {
              role: 'combobox',
              'aria-expanded': true,
              'aria-controls': listId,
              'aria-autocomplete': 'list' as const,
            }
          : {})}
        onChange={(event) => {
          setQuestion(event.target.value);
          setCaret(event.target.selectionStart);
          setClosed(false);
          setActive(0);
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onKeyDown={(event) => {
          if (open) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const step = event.key === 'ArrowDown' ? 1 : -1;
              setActive((index) => (index + step + list.length) % list.length);
              return;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault();
              const item = list[active];
              if (item) choose(item);
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setClosed(true);
              return;
            }
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
        className="max-h-40 min-h-11 w-full resize-none border-0 bg-transparent leading-[1.5] text-fg outline-0 placeholder:text-fg-muted"
      />
      <div className="flex items-center gap-0.5">
        {options.attach && (
          <>
            {tool(words.attach, 'clip', () => picker.current?.click())}
            <input
              ref={picker}
              type="file"
              multiple
              hidden
              {...(options.attach.accept ? { accept: options.attach.accept } : {})}
              onChange={(event) => {
                const chosen = Array.from(event.target.files ?? []);
                if (chosen.length) options.attach?.onFiles(chosen);
                event.target.value = '';
              }}
            />
          </>
        )}
        {options.mentions && tool(words.cite, 'at', () => insert('@'))}
        {options.gestures && tool(words.gestures, 'slash', () => insert('/'))}
        {options.dictate && Speech && tool(words.dictate, 'mic', dictate, listening)}
        <div className="flex-1" />
        <button
          type="submit"
          aria-label={running ? words.stop : words.send}
          title={running ? words.stop : words.send}
          className={
            running
              ? 'grid size-8 place-items-center rounded-[5px] bg-agent text-on-agent'
              : 'grid size-8 place-items-center rounded-[5px] bg-action text-on-action hover:bg-action-strong'
          }
        >
          <CanvasIcon name={running ? 'stop' : 'up'} />
        </button>
      </div>
    </form>
  );
}
