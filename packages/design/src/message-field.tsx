import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CanvasIcon, type CanvasIconName } from './canvas-icon.js';

// The one composer (spec 140, FR-018; canvas v6.2): what a person writes in a thread or asks Kete.
// One line that grows up to eight; 🎤 that becomes ➤ as soon as she writes; ＋ for a file or a
// gesture, « @ » for someone, « # » for something, « / » for a gesture; files dropped or pasted; a
// reply quoted above; a voice note recorded in place; the product's toggles beside « send ».
// Enter sends on a computer, breaks the line on a phone. Every word comes through props.

export type FieldTrigger = '@' | '#' | '/';

/** What « @ », « # » or « / » offers: a person, an object in its state, a gesture. */
export interface FieldPick {
  id: string;
  label: string;
  hint?: string;
  avatar?: ReactNode;
}

/** What she picked and kept in her words, for the product to say. */
export interface FieldPicked {
  trigger: FieldTrigger;
  id: string;
  label: string;
}

/** A file joined to the next message, as the product sends it. */
export interface FieldFile {
  id: string;
  name: string;
  state: 'sending' | 'ready' | 'failed';
  /** « 60 % », « prête »… */
  detail?: string;
  kind?: 'image' | 'audio' | 'file';
}

export interface MessageFieldWords {
  field: string;
  placeholder: string;
  send: string;
  stop: string;
  add: string;
  attach: string;
  mention: string;
  cite: string;
  /** « / »: the gestures offered, when the product gives some. */
  gestures?: string;
  emoji: string;
  moreEmoji: string;
  remove: string;
  cancelReply: string;
  record: string;
  recording: string;
  cancelRecording: string;
  sendRecording: string;
  dictate: string;
}

export interface MessageFieldProps {
  words: MessageFieldWords;
  /** She sends; the product answers `false` to keep the words (a refusal it shows). */
  onSend: (text: string, picked: FieldPicked[]) => unknown;
  /** An answer runs: « send » becomes « stop ». */
  busy?: boolean;
  onStop?: () => void;
  /** What a trigger offers for what she typed after it. */
  search?: (trigger: FieldTrigger, query: string) => FieldPick[] | Promise<FieldPick[]>;
  /** The triggers the product offers (default « @ »). */
  triggers?: FieldTrigger[];
  files?: {
    items: FieldFile[];
    accept?: string;
    onFiles: (files: File[]) => void;
    onRemove: (id: string) => void;
  };
  /** A voice note recorded in place (the browser's recorder). */
  voice?: { onRecorded: (audio: Blob, durationMs: number) => void };
  /** Her words dictated (the browser's speech recognition), where there is no voice note. */
  dictate?: { lang?: string };
  /** The message she answers, quoted above. */
  reply?: { text: ReactNode; onCancel: () => void } | null;
  /** The product's toggles, beside « send ». */
  toggles?: ReactNode;
  /** Under the words: an action's whom and when, where a message to the outside leaves. */
  below?: ReactNode;
  /** `alert`: the words leave the organization — the frame says so. */
  tone?: 'plain' | 'alert';
  emojis?: string[];
  onMoreEmoji?: () => void;
  /** What ＋ offers beyond a file. */
  menu?: {
    id: string;
    label: string;
    hint?: string;
    icon?: CanvasIconName;
    onSelect: () => void;
  }[];
  /** Where her unsent words are kept on this device: one draft per thread. */
  draftKey?: string;
  /** She is writing: told at most every three seconds. */
  onTyping?: () => void;
  /** ↑ in an empty field: edit her last message. */
  onEditLast?: () => void;
  /** Words the product puts in the field for her to finish. */
  prefill?: { text: string; at: number };
  /** Under the frame: Enter sends, a reminder of what Kete may do. */
  hint?: ReactNode;
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

const stored = {
  read(key: string | undefined): string {
    if (!key) return '';
    try {
      return window.localStorage.getItem(`kete:draft:${key}`) ?? '';
    } catch {
      return '';
    }
  },
  write(key: string | undefined, text: string) {
    if (!key) return;
    try {
      if (text) window.localStorage.setItem(`kete:draft:${key}`, text);
      else window.localStorage.removeItem(`kete:draft:${key}`);
    } catch {
      // A private window keeps no draft: the words stay in the field.
    }
  },
};

/** The word she is typing after a trigger, before the caret. */
export function triggered(
  text: string,
  caret: number,
  triggers: FieldTrigger[],
): { trigger: FieldTrigger; query: string; at: number } | null {
  const found = /(^|\s)([@#/])([^\s@#/]*)$/.exec(text.slice(0, caret));
  if (!found) return null;
  const trigger = found[2] as FieldTrigger;
  if (!triggers.includes(trigger)) return null;
  const query = found[3] ?? '';
  return { trigger, query, at: caret - query.length - 1 };
}

const coarse = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

const time = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function MessageField({
  words,
  onSend,
  busy = false,
  onStop,
  search,
  triggers = ['@'],
  files,
  voice,
  dictate,
  reply,
  toggles,
  below,
  tone = 'plain',
  emojis,
  onMoreEmoji,
  menu,
  draftKey,
  onTyping,
  onEditLast,
  prefill,
  hint,
}: MessageFieldProps) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<FieldPicked[]>([]);
  const [caret, setCaret] = useState(0);
  const [list, setList] = useState<FieldPick[]>([]);
  const [active, setActive] = useState(0);
  const [closed, setClosed] = useState(false);
  const [panel, setPanel] = useState<'menu' | 'emoji' | null>(null);
  const [recording, setRecording] = useState<{ since: number; now: number } | null>(null);
  const [listening, setListening] = useState(false);
  const [Speech, setSpeech] = useState<(new () => Recognition) | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const recorder = useRef<{ media: MediaRecorder; chunks: Blob[]; keep: boolean } | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const lastTyping = useRef(0);
  const listId = useId();
  const fieldId = useId();

  // Her draft for this thread comes back; a new thread starts from its own.
  useEffect(() => {
    const draft = stored.read(draftKey);
    setText(draft);
    setPicked([]);
  }, [draftKey]);
  useEffect(() => stored.write(draftKey, text), [draftKey, text]);
  useEffect(() => setSpeech(() => speechRecognition()), []);
  useEffect(
    () => () => {
      recognition.current?.stop();
      if (recorder.current?.media.state === 'recording') recorder.current.media.stop();
    },
    [],
  );
  useEffect(() => {
    if (!prefill) return;
    setText(prefill.text);
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(prefill.text.length, prefill.text.length);
    });
    // A new prefill is a new moment, even with the same words.
  }, [prefill?.at]);
  useEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 8 * 21 + 16)}px`;
  }, [text]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setRecording((r) => (r ? { ...r, now: Date.now() } : r)), 250);
    return () => clearInterval(timer);
  }, [recording !== null]);

  const word = closed ? null : triggered(text, caret, triggers);
  useEffect(() => {
    let alive = true;
    if (!word || !search) {
      setList([]);
      return;
    }
    void Promise.resolve(search(word.trigger, word.query)).then((found) => {
      if (alive) {
        setList(found.slice(0, 8));
        setActive(0);
      }
    });
    return () => {
      alive = false;
    };
  }, [word?.trigger, word?.query, search]);
  const open = list.length > 0 && word !== null;

  const ready = (files?.items ?? []).filter((f) => f.state === 'ready');
  const sending = (files?.items ?? []).some((f) => f.state === 'sending');
  const canSend = (text.trim().length > 0 || ready.length > 0) && !sending;

  const send = async () => {
    if (busy || !canSend) return;
    const said = text.trim();
    const kept = picked.filter((p) => said.includes(`${p.trigger}${p.label}`));
    const answer = await onSend(said, kept);
    if (answer === false) return;
    setText('');
    setPicked([]);
    stored.write(draftKey, '');
  };
  const choose = (item: FieldPick) => {
    if (!word) return;
    const before = text.slice(0, word.at);
    const after = text.slice(caret);
    const inserted = `${word.trigger}${item.label} `;
    setText(before + inserted + after);
    setPicked((all) => [...all, { trigger: word.trigger, id: item.id, label: item.label }]);
    const place = before.length + inserted.length;
    setCaret(place);
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(place, place);
    });
  };
  const insert = (value: string, spaced = true) => {
    const element = field.current;
    const at = element?.selectionStart ?? text.length;
    const glue = spaced && at > 0 && !/\s/.test(text[at - 1] ?? '') ? ' ' : '';
    const next = text.slice(0, at) + glue + value + text.slice(at);
    const place = at + glue.length + value.length;
    setText(next);
    setCaret(place);
    setClosed(false);
    setPanel(null);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(place, place);
    });
  };
  const typing = () => {
    if (!onTyping) return;
    const now = Date.now();
    if (now - lastTyping.current > 3000) {
      lastTyping.current = now;
      onTyping();
    }
  };

  const record = async () => {
    if (!voice || typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const media = new MediaRecorder(stream);
    const state = { media, chunks: [] as Blob[], keep: true };
    recorder.current = state;
    const since = Date.now();
    media.ondataavailable = (event) => state.chunks.push(event.data);
    media.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      setRecording(null);
      if (state.keep && state.chunks.length > 0) {
        voice.onRecorded(new Blob(state.chunks, { type: media.mimeType }), Date.now() - since);
      }
    };
    media.start();
    setRecording({ since, now: since });
  };
  const stopRecording = (keep: boolean) => {
    const state = recorder.current;
    if (!state) return;
    state.keep = keep;
    if (state.media.state === 'recording') state.media.stop();
  };
  const listen = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    if (!Speech) return;
    const listener = new Speech();
    listener.lang =
      dictate?.lang ?? (typeof document !== 'undefined' ? document.documentElement.lang : '');
    listener.interimResults = false;
    listener.continuous = false;
    listener.onresult = (event) => {
      const said = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (said) setText((current) => (current.trim() ? `${current.trimEnd()} ${said}` : said));
    };
    listener.onend = () => setListening(false);
    listener.onerror = () => setListening(false);
    recognition.current = listener;
    setListening(true);
    listener.start();
  };

  const tool = (
    label: string,
    icon: CanvasIconName | null,
    onClick: () => void,
    glyph?: string,
    phone = true,
  ) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-grid size-8 place-items-center rounded-[6px] text-fg-soft hover:bg-surface-hover hover:text-fg max-[520px]:size-7 ${phone ? '' : 'max-[520px]:hidden'}`}
    >
      {icon ? <CanvasIcon name={icon} size={18} /> : <b className="text-[15px]">{glyph}</b>}
    </button>
  );
  const round =
    'inline-grid size-9 flex-none place-items-center rounded-full bg-action text-on-action hover:bg-action-strong disabled:opacity-40';
  const showMic = Boolean(voice) && !canSend && !busy;

  return (
    <div className="relative">
      <form
        aria-label={words.field}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy && onStop) onStop();
          else void send();
        }}
        onDragOver={(event) => files && event.preventDefault()}
        onDrop={(event) => {
          if (!files) return;
          event.preventDefault();
          const dropped = Array.from(event.dataTransfer.files);
          if (dropped.length > 0) files.onFiles(dropped);
        }}
        data-tone={tone}
        className="grid rounded-[12px] border border-line-strong bg-surface-control focus-within:border-fg-soft data-[tone=alert]:border-state-verify-fg data-[tone=alert]:shadow-[0_0_0_3px_var(--color-state-verify-surface)]"
      >
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={word?.trigger === '#' ? words.cite : words.mention}
            className="absolute bottom-full left-0 z-20 mb-1.5 grid max-h-72 w-[min(340px,100%)] list-none gap-px overflow-auto rounded-[9px] border border-line-strong bg-surface p-1 shadow-[0_10px_30px_#0000002e]"
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
                className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[6px] px-2 py-1.5 text-[13px] aria-selected:bg-surface-hover"
              >
                {item.avatar ?? (
                  <CanvasIcon name={word?.trigger === '#' ? 'hash' : 'user'} size={14} />
                )}
                <span className="truncate">{item.label}</span>
                {item.hint && (
                  <small className="truncate text-[11.5px] text-fg-muted">{item.hint}</small>
                )}
              </li>
            ))}
          </ul>
        )}
        {panel && (
          <div className="absolute bottom-full left-0 z-20 mb-1.5 grid w-[min(320px,100%)] gap-px rounded-[9px] border border-line-strong bg-surface p-1 shadow-[0_10px_30px_#0000002e]">
            {panel === 'emoji' ? (
              <>
                <span className="flex flex-wrap gap-0.5 p-1">
                  {(emojis ?? []).map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insert(emoji, false)}
                      className="grid size-9 place-items-center rounded-[6px] text-[19px] hover:bg-surface-hover"
                    >
                      {emoji}
                    </button>
                  ))}
                </span>
                {onMoreEmoji && (
                  <button
                    type="button"
                    onClick={() => {
                      setPanel(null);
                      onMoreEmoji();
                    }}
                    className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] hover:bg-surface-hover"
                  >
                    <CanvasIcon name="search" size={14} />
                    {words.moreEmoji}
                  </button>
                )}
              </>
            ) : (
              <>
                {files && (
                  <button
                    type="button"
                    onClick={() => {
                      setPanel(null);
                      picker.current?.click();
                    }}
                    className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] hover:bg-surface-hover"
                  >
                    <CanvasIcon name="clip" size={14} />
                    {words.attach}
                  </button>
                )}
                {(menu ?? []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPanel(null);
                      item.onSelect();
                    }}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] hover:bg-surface-hover"
                  >
                    <CanvasIcon name={item.icon ?? 'plus'} size={14} />
                    <span>{item.label}</span>
                    {item.hint && (
                      <small className="text-[11.5px] text-fg-muted">{item.hint}</small>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
        {reply && (
          <p className="flex items-center gap-2 border-b border-line px-2.5 py-1.5 text-[12.5px] text-fg-soft">
            <CanvasIcon name="reply" size={14} />
            <span className="min-w-0 flex-1 truncate">{reply.text}</span>
            <button
              type="button"
              aria-label={words.cancelReply}
              onClick={reply.onCancel}
              className="grid size-6 place-items-center rounded-[5px] text-fg-muted hover:bg-surface-hover"
            >
              <CanvasIcon name="x" size={13} />
            </button>
          </p>
        )}
        {files && files.items.length > 0 && (
          <ul className="flex list-none flex-wrap gap-1.5 px-2.5 pt-2">
            {files.items.map((file) => (
              <li
                key={file.id}
                data-file={file.state}
                className="inline-flex h-[24px] max-w-full items-center gap-1.5 rounded-[5px] border border-line-control bg-surface pl-2 pr-1 text-[12px] text-fg-soft data-[file=failed]:border-state-error-fg data-[file=failed]:text-state-error-fg"
              >
                <CanvasIcon
                  name={file.kind === 'image' ? 'image' : file.kind === 'audio' ? 'mic' : 'clip'}
                  size={13}
                />
                <span className="truncate">{file.name}</span>
                {file.detail && <span className="text-[11px] text-fg-muted">{file.detail}</span>}
                <button
                  type="button"
                  aria-label={`${words.remove} · ${file.name}`}
                  onClick={() => files.onRemove(file.id)}
                  className="grid size-5 place-items-center rounded-[4px] text-fg-muted hover:bg-surface-hover hover:text-fg"
                >
                  <CanvasIcon name="x" size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {recording ? (
          <div className="flex items-center gap-2.5 py-2 pr-2 pl-3.5" role="status">
            <span className="size-2.5 flex-none animate-pulse rounded-full bg-state-error-fg" />
            <span className="font-number text-[13px]">{time(recording.now - recording.since)}</span>
            <span className="text-[12.5px] text-fg-muted">{words.recording}</span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => stopRecording(false)}
              className="inline-flex h-8 items-center gap-1 rounded-[6px] px-2 text-[12.5px] font-semibold text-fg-soft hover:bg-surface-hover"
            >
              <CanvasIcon name="x" size={14} />
              {words.cancelRecording}
            </button>
            <button
              type="button"
              aria-label={words.sendRecording}
              onClick={() => stopRecording(true)}
              className={round}
            >
              <CanvasIcon name="send" size={17} />
            </button>
          </div>
        ) : (
          <>
            <label htmlFor={fieldId} className="sr-only">
              {words.field}
            </label>
            <textarea
              id={fieldId}
              ref={field}
              rows={1}
              value={text}
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
                setText(event.target.value);
                setCaret(event.target.selectionStart);
                setClosed(false);
                typing();
              }}
              onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
              onPaste={(event) => {
                if (!files) return;
                const pasted = Array.from(event.clipboardData.files);
                if (pasted.length > 0) {
                  event.preventDefault();
                  files.onFiles(pasted);
                }
              }}
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
                if (event.key === 'ArrowUp' && !text && onEditLast) {
                  event.preventDefault();
                  onEditLast();
                  return;
                }
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing &&
                  !coarse()
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
              className="max-h-[184px] min-h-10 w-full resize-none border-0 bg-transparent px-3 pt-2.5 pb-1 leading-[1.45] text-fg outline-0 placeholder:text-fg-muted"
            />
            {below}
            <div className="flex flex-wrap items-center gap-1 px-1.5 pt-0.5 pb-1.5 max-[520px]:flex-nowrap max-[520px]:gap-0.5">
              {(files || (menu && menu.length > 0)) &&
                tool(words.add, 'plus', () => setPanel((p) => (p === 'menu' ? null : 'menu')))}
              {triggers.includes('@') && tool(words.mention, null, () => insert('@'), '@')}
              {triggers.includes('#') && tool(words.cite, 'hash', () => insert('#'))}
              {triggers.includes('/') &&
                tool(words.gestures ?? words.add, 'slash', () => insert('/'))}
              {emojis &&
                emojis.length > 0 &&
                tool(
                  words.emoji,
                  'smile',
                  () => setPanel((p) => (p === 'emoji' ? null : 'emoji')),
                  undefined,
                  false,
                )}
              {dictate && Speech && !voice && (
                <button
                  type="button"
                  aria-label={words.dictate}
                  title={words.dictate}
                  aria-pressed={listening}
                  onClick={listen}
                  className="inline-grid size-8 place-items-center rounded-[6px] text-fg-soft hover:bg-surface-hover aria-pressed:bg-agent aria-pressed:text-on-agent"
                >
                  <CanvasIcon name="mic" size={18} />
                </button>
              )}
              <span className="flex-1" />
              {toggles}
              {busy && onStop ? (
                <button type="submit" aria-label={words.stop} className={round}>
                  <CanvasIcon name="stop" size={17} />
                </button>
              ) : showMic ? (
                <button
                  type="button"
                  aria-label={words.record}
                  onClick={() => void record()}
                  className={round}
                >
                  <CanvasIcon name="mic" size={17} />
                </button>
              ) : (
                <button type="submit" aria-label={words.send} disabled={!canSend} className={round}>
                  <CanvasIcon name="send" size={17} />
                </button>
              )}
            </div>
          </>
        )}
        {files && (
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            {...(files.accept ? { accept: files.accept } : {})}
            onChange={(event) => {
              const chosen = Array.from(event.target.files ?? []);
              if (chosen.length > 0) files.onFiles(chosen);
              event.target.value = '';
            }}
          />
        )}
      </form>
      {hint && <p className="mt-1 px-1 text-[11.5px] text-fg-muted">{hint}</p>}
    </div>
  );
}

/** A toggle beside « send »: « Interne / Au client », « Pour info / Pour action ». */
export function FieldToggle({
  pressed,
  onToggle,
  icon,
  children,
  title,
}: {
  pressed: boolean;
  onToggle: () => void;
  icon?: CanvasIconName;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      {...(title ? { title } : {})}
      className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-line-control bg-surface px-2.5 text-[12.5px] font-semibold whitespace-nowrap text-fg-soft max-[520px]:gap-1 max-[520px]:px-2 max-[520px]:text-[12px] hover:bg-surface-hover aria-pressed:border-state-verify-fg aria-pressed:bg-state-verify-surface aria-pressed:text-state-verify-fg"
    >
      {icon && <CanvasIcon name={icon} size={14} />}
      {children}
    </button>
  );
}
