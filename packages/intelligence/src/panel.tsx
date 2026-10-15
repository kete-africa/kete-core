import { CanvasIcon, FrameSpark, Markdown, type CanvasIconName } from '@kete/design';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Composer, type ComposerOptions, type PickedItem } from './composer.js';
import type { Turn } from './turn.js';

// Kete Intelligence's drawer (kete-core specs 101, 108; the validated canvas v3.1): its head —
// « Demander » and « Fichiers », the threads, a new one, wider, close — the page she asks from and
// how far it looks, the conversation — each answer with its seconds, what it does now, its plan
// checked as it goes, each capability with its level and what it was called with, its drafts, its
// words as they come, its sources, its tally — and the field, with « Arrêter » while it answers.
// Every word comes through `words`.

export interface IntelligenceWords {
  /** « Kete Intelligence »: who answers. */
  name: string;
  thread: string;
  composer: string;
  placeholder: string;
  send: string;
  stop: string;
  /** Under the field: « Agit avec vos droits · prépare, vous décidez… ». */
  hint?: string;
  /** « Contexte ». */
  context: string;
  removeContext: string;
  suggestions: string;
  thinking: string;
  reading: (tool: string) => string;
  /** « Plan ». */
  plan: string;
  level: (level: number) => string;
  sources: string;
  draft: string;
  verify: string;
  /** « 4 étapes · 3 gestes · 5 s ». */
  tally: (steps: number, gestures: number, seconds: number) => string;
  seconds: (seconds: number) => string;
  stopped: string;
  /** A reason given as a code: no model, no budget, a gesture waiting for her confirmation. */
  reason: (code: string) => string;
  copy: string;
  /** « Régénérer »: the same plan, other words; the figures do not change. */
  retry?: string;
  /** The head of the drawer. */
  ask: string;
  files: string;
  history: string;
  newThread: string;
  wide: string;
  close: string;
  /** The composer's tools. */
  attach: string;
  cite: string;
  gestures: string;
  dictate: string;
}

/** The drawer's head: its two tabs, the threads, a new thread, wider, close. */
export interface IntelligenceHead {
  tab: 'ask' | 'files';
  onTab?: (tab: 'ask' | 'files') => void;
  onHistory?: () => void;
  onNew?: () => void;
  wide?: boolean;
  onWide?: () => void;
  onClose: () => void;
}

function HeadButton({
  label,
  icon,
  onClick,
  pressed,
  className = '',
}: {
  label: string;
  icon: CanvasIconName;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      {...(pressed !== undefined ? { 'aria-pressed': pressed } : {})}
      className={`inline-grid size-8 place-items-center rounded-[5px] text-fg-soft hover:bg-surface-hover hover:text-fg aria-pressed:bg-surface-selected aria-pressed:text-fg max-[640px]:size-10 ${className}`}
    >
      <CanvasIcon name={icon} />
    </button>
  );
}

function Head({ head, words }: { head: IntelligenceHead; words: IntelligenceWords }) {
  const tab = (id: 'ask' | 'files', icon: CanvasIconName, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={head.tab === id}
      onClick={() => head.onTab?.(id)}
      className="flex h-7 items-center gap-1.5 whitespace-nowrap rounded-[4px] px-2.5 text-[13px] font-semibold text-fg-muted hover:text-fg aria-selected:bg-surface-selected aria-selected:text-fg"
    >
      <CanvasIcon name={icon} size={16} />
      {label}
    </button>
  );
  return (
    <div className="flex min-h-[54px] items-center gap-1 border-b border-line py-[9px] pl-3 pr-2.5">
      <div
        role="tablist"
        className="inline-flex rounded-[5px] border border-line-control bg-surface-control p-0.5"
      >
        {tab('ask', 'spark', words.ask)}
        {head.onTab && tab('files', 'clip', words.files)}
      </div>
      <div className="flex-1" />
      {head.onHistory && <HeadButton label={words.history} icon="hist" onClick={head.onHistory} />}
      {head.onNew && <HeadButton label={words.newThread} icon="plus" onClick={head.onNew} />}
      {head.onWide && (
        <HeadButton
          label={words.wide}
          icon="expand"
          onClick={head.onWide}
          pressed={Boolean(head.wide)}
          className="max-[640px]:hidden"
        />
      )}
      <HeadButton label={words.close} icon="x" onClick={head.onClose} />
    </div>
  );
}

/** The seconds an answer has run, ticking while it runs. */
function Seconds({ turn, words }: { turn: Turn; words: IntelligenceWords }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (turn.state !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [turn.state]);
  const ms = turn.ms ?? (turn.startedAt !== undefined ? now - turn.startedAt : undefined);
  if (ms === undefined) return null;
  return (
    <span className="ml-auto font-number tabular-nums">{words.seconds(Math.round(ms / 1000))}</span>
  );
}

function Answer({
  turn,
  words,
  toolLabel,
  renderDraft,
  onCopy,
  onRetry,
  actions,
  after,
}: {
  turn: Turn;
  words: IntelligenceWords;
  toolLabel: (name: string) => string;
  renderDraft?: (draft: Turn['drafts'][number]) => ReactNode;
  onCopy?: (text: string) => void;
  onRetry?: () => void;
  actions?: ReactNode;
  after?: ReactNode;
}) {
  const running = turn.state === 'running';
  const tool = [...turn.tools].reverse().find((item) => item.state === 'running');
  const live = turn.status ?? (tool ? words.reading(toolLabel(tool.name)) : words.thinking);
  const done = turn.plan.filter((item) => item.state === 'done').length;
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-2.5" data-turn={turn.state}>
      <div className="flex items-center gap-2 text-[12px] text-fg-muted">
        <FrameSpark />
        {words.name}
        <Seconds turn={turn} words={words} />
      </div>
      {running && (
        <p role="status" className="m-0 flex items-center gap-[9px] text-[13px]">
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 rounded-full border-2 border-line-strong border-t-accent motion-safe:animate-spin"
          />
          <span className="bg-[linear-gradient(90deg,var(--color-fg-muted)_0%,var(--color-fg)_40%,var(--color-fg-muted)_80%)] bg-[length:200%_100%] bg-clip-text text-transparent motion-safe:animate-[kete-shimmer_1.6s_linear_infinite] motion-reduce:text-fg">
            {live}
          </span>
        </p>
      )}
      {turn.plan.length > 0 && (
        <div className="overflow-hidden rounded-[5px] border border-line">
          <div className="flex items-center gap-2 border-b border-line bg-surface-control px-3 py-[7px] text-[12px] text-fg-muted">
            {words.plan} · {done}/{turn.plan.length}
          </div>
          <ol className="m-0 list-none px-3 pb-2.5 pt-2" aria-label={words.plan}>
            {turn.plan.map((item, index) => (
              <li
                key={index}
                data-step={item.state}
                className="flex items-center gap-2.5 py-1 text-[13px] text-fg-muted data-[step=done]:text-fg-soft data-[step=running]:text-fg"
              >
                <span
                  aria-hidden="true"
                  className={
                    item.state === 'done'
                      ? 'grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] border-state-success bg-state-success text-on-action'
                      : item.state === 'running'
                        ? 'size-4 shrink-0 rounded-full border-[1.5px] border-accent border-t-transparent motion-safe:animate-spin'
                        : 'size-4 shrink-0 rounded-full border-[1.5px] border-line-strong'
                  }
                >
                  {item.state === 'done' && <CanvasIcon name="ok" size={11} />}
                </span>
                {item.step}
              </li>
            ))}
          </ol>
        </div>
      )}
      {turn.tools.length > 0 && (
        <div className="flex flex-col gap-2">
          {turn.tools.map((call) => (
            <details
              key={call.id}
              data-tool={call.state}
              className="overflow-hidden rounded-[5px] border border-line text-[13px]"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 bg-surface-control px-3 py-2 hover:bg-surface-hover [&::-webkit-details-marker]:hidden">
                <span
                  className={
                    call.state === 'done'
                      ? 'text-state-success'
                      : call.state === 'failed'
                        ? 'text-state-error'
                        : 'text-fg-muted'
                  }
                >
                  {call.state === 'running' ? (
                    <span
                      aria-hidden="true"
                      className="block size-3.5 rounded-full border-2 border-line-strong border-t-accent motion-safe:animate-spin"
                    />
                  ) : (
                    <CanvasIcon name={call.state === 'failed' ? 'x' : 'ok'} size={16} />
                  )}
                </span>
                <span className="font-number text-[12px]" title={toolLabel(call.name)}>
                  {call.name}
                </span>
                <span
                  className={
                    call.level >= 3
                      ? 'whitespace-nowrap rounded-[4px] bg-agent px-1.5 py-px text-[11px] text-on-agent'
                      : 'whitespace-nowrap rounded-[4px] bg-surface-selected px-1.5 py-px text-[11px] text-fg-soft'
                  }
                >
                  {words.level(call.level)}
                </span>
                {call.summary && (
                  <span className="ml-auto min-w-0 truncate text-[12px] text-fg-muted">
                    {call.summary}
                  </span>
                )}
              </summary>
              {(call.input || call.summary) && (
                <pre className="m-0 overflow-x-auto whitespace-pre-wrap border-t border-line px-3 py-2.5 font-number text-[12px] leading-[1.55] text-fg-soft">
                  {[call.input && `→ ${call.input}`, call.summary && `← ${call.summary}`]
                    .filter(Boolean)
                    .join('\n')}
                </pre>
              )}
            </details>
          ))}
        </div>
      )}
      {turn.drafts.map((draft) => (
        <div key={draft.id}>
          {renderDraft ? (
            renderDraft(draft)
          ) : (
            <div className="overflow-hidden rounded-[5px] border border-line-strong bg-surface">
              <div className="flex flex-wrap items-center gap-2.5 bg-surface-raised px-3.5 py-2.5">
                <FrameSpark />
                <span className="font-semibold">
                  {words.draft} · {draft.title}
                </span>
                {draft.href && (
                  <a
                    href={draft.href}
                    className="ml-auto inline-flex h-7 items-center rounded-[5px] border border-line-control bg-surface-control px-2.5 text-[13px] font-semibold text-fg no-underline hover:bg-surface-hover"
                  >
                    {words.verify}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      {(turn.text || running) && (
        <div
          className={`text-[14px] leading-[1.65] [&_p]:mb-2.5 [&_p]:mt-0 ${running ? 'kete-caret' : ''}`}
        >
          {turn.text && <Markdown text={turn.text} />}
        </div>
      )}
      {after}
      {turn.sources.length > 0 && (
        <ul aria-label={words.sources} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {turn.sources.map((source, index) => {
            const className =
              'inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-[5px] border border-line-control bg-surface-control px-[9px] text-[12px] text-fg-soft no-underline hover:border-accent hover:text-fg';
            return (
              <li key={index}>
                {source.href ? (
                  <a href={source.href} className={className}>
                    <CanvasIcon name="doc" size={14} />
                    {source.label}
                  </a>
                ) : (
                  <span className={className}>
                    <CanvasIcon name="doc" size={14} />
                    {source.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {turn.state === 'done' && (
        <div className="flex flex-wrap items-center gap-1">
          {actions}
          {onCopy && turn.text && (
            <button
              type="button"
              aria-label={words.copy}
              title={words.copy}
              onClick={() => onCopy(turn.text)}
              className="inline-grid size-7 place-items-center rounded-[5px] text-fg-soft hover:bg-surface-hover hover:text-fg"
            >
              <CanvasIcon name="copy" size={16} />
            </button>
          )}
          {onRetry && words.retry && (
            <button
              type="button"
              aria-label={words.retry}
              title={words.retry}
              onClick={onRetry}
              className="inline-grid size-7 place-items-center rounded-[5px] text-fg-soft hover:bg-surface-hover hover:text-fg"
            >
              <CanvasIcon name="retry" size={16} />
            </button>
          )}
          {turn.ms !== undefined && (
            <span className="ml-1.5 text-[12px] text-fg-muted">
              {words.tally(
                turn.plan.length,
                turn.tools.length,
                Math.max(1, Math.round(turn.ms / 1000)),
              )}
            </span>
          )}
        </div>
      )}
      {turn.state === 'stopped' && <p className="m-0 text-[13px] text-fg-muted">{words.stopped}</p>}
      {(turn.state === 'failed' || turn.state === 'waiting') && turn.reason && (
        <p
          role={turn.state === 'failed' ? 'alert' : undefined}
          className={
            turn.state === 'failed'
              ? 'm-0 rounded-[5px] border border-state-error bg-state-error-surface px-3 py-2 text-[13px] text-state-error-fg'
              : 'm-0 rounded-[5px] border border-state-verify bg-state-verify-surface px-3 py-2 text-[13px] text-state-verify-fg'
          }
        >
          {words.reason(turn.reason)}
        </p>
      )}
    </div>
  );
}

/**
 * Kete Intelligence: beside the page in the drawer (with its `head`), or as the whole page of
 * « Demander ». `files`: what the « Fichiers » tab shows.
 */
export function IntelligencePanel({
  turns,
  running,
  onSend,
  onStop,
  words,
  head,
  files,
  context,
  scope,
  suggestions = [],
  intro,
  toolLabel = (name) => name,
  renderDraft,
  renderAfter,
  onRetry,
  answerActions,
  composer,
}: {
  turns: readonly Turn[];
  running: boolean;
  /** A question, with what she picked and kept in it (@ an object, / a gesture). */
  onSend: (question: string, picks: PickedItem[]) => void;
  onStop: () => void;
  words: IntelligenceWords;
  head?: IntelligenceHead;
  files?: ReactNode;
  /** The page she asks from, given with her question; she may take it away. */
  context?: { label: string; onRemove?: () => void };
  /** How far it looks: « Dans tout Kete », « Dans cette app ». */
  scope?: {
    value: string;
    label: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  };
  suggestions?: readonly string[];
  /** What it says before anything is asked. */
  intro?: ReactNode;
  /** A capability's name in the person's words. */
  toolLabel?: (name: string) => string;
  /** The product's own verification card for a draft. */
  renderDraft?: (draft: Turn['drafts'][number]) => ReactNode;
  /**
   * What the product shows after an answer's words, beyond the contract: a table it read, an app's
   * view. `index` is the turn's place in the thread.
   */
  renderAfter?: (turn: Turn, index: number) => ReactNode;
  /** Asks the same question again. */
  onRetry?: (turn: Turn) => void;
  /** The product's gestures on a finished answer, before « Copier »: « Épingler au tableau ». */
  answerActions?: (turn: Turn) => ReactNode;
  /** What the field offers beyond the words: files, objects to cite, gestures, her voice. */
  composer?: ComposerOptions;
}) {
  const thread = useRef<HTMLDivElement>(null);
  const last = turns.at(-1);
  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight });
  }, [turns.length, last?.text, last?.tools.length, last?.state]);
  const showFiles = head?.tab === 'files' && files;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-intelligence>
      {head && <Head head={head} words={words} />}
      {showFiles ? (
        <div className="min-h-0 flex-1 overflow-auto">{files}</div>
      ) : (
        <>
          {(context || scope) && (
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3.5 py-2 text-[12px] text-fg-muted">
              <span>{words.context}</span>
              {context && (
                <span className="inline-flex h-[26px] min-w-0 max-w-full items-center gap-1.5 rounded-[5px] bg-surface-selected pl-2 pr-1 text-[12px] text-fg">
                  <CanvasIcon name="doc" size={14} />
                  <span className="truncate">{context.label}</span>
                  {context.onRemove && (
                    <button
                      type="button"
                      aria-label={words.removeContext}
                      onClick={context.onRemove}
                      className="grid size-5 place-items-center rounded-[4px] text-fg-muted hover:bg-surface-hover hover:text-fg"
                    >
                      <CanvasIcon name="x" size={12} />
                    </button>
                  )}
                </span>
              )}
              {scope && (
                <select
                  aria-label={scope.label}
                  value={scope.value}
                  onChange={(event) => scope.onChange(event.target.value)}
                  className="ml-auto h-[26px] rounded-[5px] border border-line-control bg-surface-control text-[12px] text-fg"
                >
                  {scope.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          <div
            ref={thread}
            role="log"
            aria-label={words.thread}
            className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-auto px-4 py-[18px]"
          >
            {intro && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-[12px] text-fg-muted">
                  <FrameSpark />
                  {words.name}
                </div>
                <div className="text-[14px] leading-[1.65]">{intro}</div>
              </div>
            )}
            {turns.map((turn, index) => (
              <div key={turn.id} className="flex flex-col gap-[18px]">
                <div className="max-w-[86%] self-end rounded-[10px_10px_3px_10px] bg-surface-selected px-[13px] py-[9px] leading-[1.5]">
                  {turn.question}
                </div>
                <Answer
                  turn={turn}
                  words={words}
                  toolLabel={toolLabel}
                  {...(renderDraft ? { renderDraft } : {})}
                  {...(onRetry && !running ? { onRetry: () => onRetry(turn) } : {})}
                  {...(answerActions ? { actions: answerActions(turn) } : {})}
                  {...(renderAfter ? { after: renderAfter(turn, index) } : {})}
                  onCopy={(text) =>
                    void navigator.clipboard?.writeText(text).catch(() => undefined)
                  }
                />
              </div>
            ))}
          </div>
          <div className="border-t border-line px-3.5 pb-3 pt-2.5">
            {!running && suggestions.length > 0 && (
              <div aria-label={words.suggestions} className="mb-2.5 flex flex-wrap gap-1.5">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => onSend(suggestion, [])}
                    {...(suggestion.length > 54 ? { title: suggestion } : {})}
                    className="rounded-[5px] border border-line-control bg-surface-control px-2.5 py-[5px] text-left text-[12px] leading-[1.35] text-fg-soft hover:border-accent hover:text-fg"
                  >
                    {suggestion.length > 54 ? `${suggestion.slice(0, 52)}…` : suggestion}
                  </button>
                ))}
              </div>
            )}
            <Composer
              running={running}
              words={words}
              onSend={onSend}
              onStop={onStop}
              {...(composer ? { options: composer } : {})}
            />
            {words.hint && (
              <p className="mb-0 mt-2 text-center text-[11px] text-fg-muted">{words.hint}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
