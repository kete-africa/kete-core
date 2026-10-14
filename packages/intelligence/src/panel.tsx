import {
  ChatMessage,
  ChatThread,
  Composer,
  Markdown,
  Suggestions,
  Tag,
  ToolCard,
} from '@kete/design';
import { useState, type ReactNode } from 'react';
import type { Turn } from './turn.js';

// The drawer of Kete Intelligence (spec 101): what the assistant does as it does it — its status,
// its plan, each capability with its level, the words as they come, a draft to verify in place,
// its sources, « Arrêter » — the same in the center and in every app. Every word through `words`.

export interface IntelligenceWords {
  thread: string;
  you: string;
  assistant: string;
  composer: string;
  placeholder: string;
  send: string;
  stop: string;
  /** Under the field: what the assistant may and may not do. */
  hint?: string;
  context: string;
  suggestions: string;
  thinking: string;
  reading: (tool: string) => string;
  plan: string;
  level: (level: number) => string;
  toolState: { running: string; done: string; failed: string };
  sources: string;
  draft: string;
  verify: string;
  done: (tools: number, seconds: number) => string;
  stopped: string;
  /** A reason given as a code: no model, no budget, a gesture waiting for her confirmation. */
  reason: (code: string) => string;
}

function Status({
  turn,
  words,
  toolLabel,
}: {
  turn: Turn;
  words: IntelligenceWords;
  toolLabel: (name: string) => string;
}) {
  const tool = [...turn.tools].reverse().find((item) => item.state === 'running');
  const text = turn.status ?? (tool ? words.reading(toolLabel(tool.name)) : words.thinking);
  return (
    <p role="status" className="m-0 flex items-center gap-2 text-body-sm text-fg-soft">
      <span
        aria-hidden="true"
        className="inline-block size-3.5 shrink-0 rounded-full border-2 border-line-strong border-t-accent motion-safe:animate-spin"
      />
      {text}
    </p>
  );
}

function Answer({
  turn,
  words,
  toolLabel,
  renderDraft,
}: {
  turn: Turn;
  words: IntelligenceWords;
  toolLabel: (name: string) => string;
  renderDraft?: (draft: Turn['drafts'][number]) => ReactNode;
}) {
  return (
    <div className="grid gap-3">
      {turn.state === 'running' && <Status turn={turn} words={words} toolLabel={toolLabel} />}
      {turn.plan.length > 0 && (
        <ol
          aria-label={words.plan}
          className="m-0 grid list-none gap-1 rounded-control border border-line p-3 text-body-sm"
        >
          {turn.plan.map((item, index) => (
            <li
              key={index}
              data-step={item.state}
              className="flex items-center gap-2 data-[step=waiting]:text-fg-muted"
            >
              <span
                aria-hidden="true"
                className={
                  item.state === 'done'
                    ? 'inline-block size-3.5 rounded-full bg-state-success'
                    : item.state === 'running'
                      ? 'inline-block size-3.5 rounded-full border-2 border-accent border-t-transparent motion-safe:animate-spin'
                      : 'inline-block size-3.5 rounded-full border-2 border-line-strong'
                }
              />
              {item.step}
            </li>
          ))}
        </ol>
      )}
      {turn.tools.length > 0 && (
        <div className="grid gap-2">
          {turn.tools.map((tool) => (
            <ToolCard
              key={tool.id}
              name={
                <span className="inline-flex items-center gap-2">
                  {toolLabel(tool.name)}
                  <Tag tone={tool.level >= 3 ? 'verify' : 'neutral'}>{words.level(tool.level)}</Tag>
                </span>
              }
              state={tool.state === 'failed' ? 'refused' : tool.state}
              stateLabel={words.toolState[tool.state]}
            />
          ))}
        </div>
      )}
      {turn.text && <Markdown text={turn.text} />}
      {turn.drafts.map((draft) => (
        <div key={draft.id}>
          {renderDraft ? (
            renderDraft(draft)
          ) : (
            <p className="m-0 flex flex-wrap items-center gap-3 rounded-control border border-line-strong p-3">
              <Tag tone="verify">{words.draft}</Tag>
              <span className="font-semibold">{toolLabel(draft.title)}</span>
              {draft.href && (
                <a href={draft.href} className="ml-auto font-semibold text-link underline">
                  {words.verify}
                </a>
              )}
            </p>
          )}
        </div>
      ))}
      {turn.sources.length > 0 && (
        <ul aria-label={words.sources} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {turn.sources.map((source, index) => (
            <li key={index}>
              {source.href ? (
                <a
                  href={source.href}
                  className="inline-flex h-6 items-center rounded-control border border-line-control px-2 text-body-sm text-fg-soft hover:border-accent"
                >
                  {source.label}
                </a>
              ) : (
                <span className="inline-flex h-6 items-center rounded-control border border-line-control px-2 text-body-sm text-fg-soft">
                  {source.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {turn.state === 'done' && turn.ms !== undefined && (
        <p className="m-0 text-body-sm text-fg-muted">
          {words.done(turn.tools.length, Math.max(1, Math.round(turn.ms / 1000)))}
        </p>
      )}
      {turn.state === 'stopped' && (
        <p className="m-0 text-body-sm text-fg-muted">{words.stopped}</p>
      )}
      {(turn.state === 'failed' || turn.state === 'waiting') && turn.reason && (
        <p
          role={turn.state === 'failed' ? 'alert' : undefined}
          className={
            turn.state === 'failed'
              ? 'm-0 rounded-control border border-state-error bg-state-error-surface px-3 py-2 text-body-sm text-state-error-fg'
              : 'm-0 rounded-control border border-state-verify bg-state-verify-surface px-3 py-2 text-body-sm text-state-verify-fg'
          }
        >
          {words.reason(turn.reason)}
        </p>
      )}
    </div>
  );
}

/**
 * The drawer's content: the page she asks from, the conversation, the suggestions while nothing
 * is asked, and the field — « Arrêter » while an answer is written.
 */
export function IntelligencePanel({
  turns,
  running,
  onSend,
  onStop,
  words,
  context,
  suggestions = [],
  intro,
  toolLabel = (name) => name,
  renderDraft,
}: {
  turns: readonly Turn[];
  running: boolean;
  onSend: (question: string) => void;
  onStop: () => void;
  words: IntelligenceWords;
  /** The page she asks from, given to the assistant with her question. */
  context?: string;
  suggestions?: readonly string[];
  /** What the assistant says before anything is asked. */
  intro?: ReactNode;
  /** A capability's name in the person's words. */
  toolLabel?: (name: string) => string;
  /** The product's own verification card for a draft. */
  renderDraft?: (draft: Turn['drafts'][number]) => ReactNode;
}) {
  const [question, setQuestion] = useState('');
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {context && (
        <p className="m-0 flex items-center gap-2 border-b border-line px-4 py-2 text-body-sm text-fg-muted">
          {words.context}
          <span className="truncate rounded-control bg-surface-selected px-2 py-0.5 text-fg">
            {context}
          </span>
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
        <ChatThread label={words.thread}>
          {turns.length === 0 && intro && (
            <ChatMessage role="assistant" author={words.assistant}>
              {intro}
            </ChatMessage>
          )}
          {turns.map((turn) => (
            <div key={turn.id} className="grid gap-5">
              <ChatMessage role="user" author={words.you}>
                {turn.question}
              </ChatMessage>
              <ChatMessage role="assistant" author={words.assistant}>
                <Answer
                  turn={turn}
                  words={words}
                  toolLabel={toolLabel}
                  {...(renderDraft ? { renderDraft } : {})}
                />
              </ChatMessage>
            </div>
          ))}
        </ChatThread>
      </div>
      <div className="px-4">
        {turns.length === 0 && suggestions.length > 0 && (
          <div className="pb-2">
            <Suggestions
              label={words.suggestions}
              items={[...suggestions]}
              onSelect={(text) => onSend(text)}
            />
          </div>
        )}
        <Composer
          label={words.composer}
          placeholder={words.placeholder}
          value={question}
          onChange={setQuestion}
          onSend={() => {
            const asked = question.trim();
            if (!asked) return;
            setQuestion('');
            onSend(asked);
          }}
          onStop={onStop}
          busy={running}
          sendLabel={words.send}
          stopLabel={words.stop}
          {...(words.hint ? { hint: words.hint } : {})}
        />
      </div>
    </div>
  );
}
