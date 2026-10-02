import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cx, IconButton } from './components.js';
import { Icon } from './workspace.js';

// The chat of an assistant, as people expect it from Copilot, ChatGPT or Claude (spec 040): a
// thread announced to assistive technology, the person's messages on the right, the assistant's
// answers in full width and formatted, the tools it used as cards, and a composer pinned at the
// bottom — Enter sends, Shift+Enter breaks the line, a running answer can be stopped. Semantic
// tokens only; every word comes through props.

/** The conversation: a log that follows the last message and announces the new ones. */
export function ChatThread({ label, children }: { label: string; children: ReactNode }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  });
  return (
    <div role="log" aria-label={label} aria-live="polite" className="flex flex-col gap-5 pb-4">
      {children}
      <div ref={end} />
    </div>
  );
}

/**
 * One message. The person's sits on the right in a bubble; the assistant's spans the column, with
 * its author, its tool cards and its actions (copy, useful, not useful, again).
 */
export function ChatMessage({
  role,
  author,
  children,
  tools,
  actions,
}: {
  role: 'user' | 'assistant';
  author?: ReactNode;
  children: ReactNode;
  tools?: ReactNode;
  actions?: ReactNode;
}) {
  if (role === 'user') {
    return (
      <div className="ml-auto max-w-[80%] rounded-box bg-surface-selected px-4 py-2.5 whitespace-pre-line text-fg">
        {children}
      </div>
    );
  }
  return (
    <article className="flex max-w-full flex-col gap-2 text-fg">
      {author && (
        <p className="flex items-center gap-2 text-body-sm font-semibold text-fg-muted">
          <span className="inline-flex text-accent [&_svg]:size-4">
            <Icon name="agent" />
          </span>
          {author}
        </p>
      )}
      {tools && <div className="flex flex-col gap-1.5">{tools}</div>}
      <div className="leading-[1.6]">{children}</div>
      {actions && <div className="flex gap-1 text-fg-muted">{actions}</div>}
    </article>
  );
}

/** A tool the assistant called: its name, its state, what it brought back (folded). */
export function ToolCard({
  name,
  state,
  stateLabel,
  children,
}: {
  name: ReactNode;
  state: 'running' | 'done' | 'refused';
  stateLabel: ReactNode;
  children?: ReactNode;
}) {
  const marker = {
    running: 'border-2 border-state-info',
    done: 'bg-state-success',
    refused: 'bg-state-error',
  }[state];
  const head = (
    <span className="flex items-center gap-2 text-body-sm">
      <span className="inline-flex [&_svg]:size-4">
        <Icon name="tool" />
      </span>
      <span className="font-semibold">{name}</span>
      <span className={cx('inline-block size-2 rounded-[2px]', marker)} aria-hidden="true" />
      <span className="text-fg-muted">{stateLabel}</span>
    </span>
  );
  return children ? (
    <details className="rounded-control border border-line bg-surface px-3 py-1.5">
      <summary className="cursor-pointer list-none">{head}</summary>
      <div className="mt-2 text-body-sm">{children}</div>
    </details>
  ) : (
    <div className="rounded-control border border-line bg-surface px-3 py-1.5">{head}</div>
  );
}

/** Copies a text, and says so for a moment. */
export function CopyButton({
  text,
  label,
  copiedLabel,
}: {
  text: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      label={copied ? copiedLabel : label}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size={16} />
    </IconButton>
  );
}

/** Suggestions to start a conversation: pills a person clicks instead of typing. */
export function Suggestions({
  label,
  items,
  onSelect,
}: {
  label: string;
  items: string[];
  onSelect: (text: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onSelect(item)}
          className="rounded-pill border border-line-control px-4 py-2 text-left text-body-sm text-fg hover:border-accent hover:bg-surface-hover"
        >
          {item}
        </button>
      ))}
    </div>
  );
}

/**
 * The composer, pinned at the bottom of the chat: it grows with the text up to eight lines; Enter
 * sends, Shift+Enter breaks the line; while an answer runs, the send button becomes « stop ».
 */
export function Composer({
  label,
  placeholder,
  value,
  onChange,
  onSend,
  onStop,
  busy = false,
  sendLabel,
  stopLabel,
  hint,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  busy?: boolean;
  sendLabel: string;
  stopLabel: string;
  /** Below the field: the model, a reminder of what the assistant may do. */
  hint?: ReactNode;
}) {
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 8 * 22 + 20)}px`;
  }, [value]);
  return (
    <div className="sticky bottom-0 bg-canvas pt-2 pb-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && value.trim()) onSend();
        }}
        className="flex items-end gap-2 rounded-overlay border border-line-control bg-surface-control px-3 py-2 focus-within:border-accent"
      >
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <textarea
          id={id}
          ref={field}
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (!busy && value.trim()) onSend();
            }
          }}
          className="max-h-[196px] min-h-[38px] flex-1 resize-none border-0 bg-transparent py-2 text-fg outline-0 placeholder:text-fg-muted"
        />
        {busy && onStop ? (
          <IconButton label={stopLabel} onClick={onStop}>
            <Icon name="stop" size={18} />
          </IconButton>
        ) : (
          <IconButton
            label={sendLabel}
            type="submit"
            disabled={!value.trim() || busy}
            className="bg-action text-on-action hover:bg-action-strong disabled:opacity-40"
          >
            <Icon name="send" size={18} />
          </IconButton>
        )}
      </form>
      {hint && <p className="mt-1.5 px-1 text-body-sm text-fg-muted">{hint}</p>}
    </div>
  );
}

// A small, safe Markdown: what an assistant writes (headings, lists, bold, italics, code, links,
// tables, paragraphs), rendered as React elements — never as HTML, so nothing it says can run.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern =
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const k = `${key}-${i++}`;
    if (token.startsWith('**')) out.push(<strong key={k}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`'))
      out.push(
        <code key={k} className="rounded-[3px] bg-surface-selected px-1 font-number text-[0.92em]">
          {token.slice(1, -1)}
        </code>,
      );
    else if (token.startsWith('[')) {
      const label = token.slice(1, token.indexOf(']'));
      const href = match[2] ?? '#';
      out.push(
        <a
          key={k}
          href={href}
          className="text-link underline"
          {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {label}
        </a>,
      );
    } else out.push(<em key={k}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());

/** Renders an assistant's Markdown as elements. */
export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let n = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const key = `b${n++}`;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) body.push(lines[i++] ?? '');
      i++;
      blocks.push(
        <pre
          key={key}
          className="overflow-x-auto rounded-control bg-surface-selected p-3 font-number text-body-sm"
        >
          {body.join('\n')}
        </pre>,
      );
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      blocks.push(
        <p
          key={key}
          role="heading"
          aria-level={Math.min(level + 2, 6)}
          className={cx('font-heading font-semibold', level <= 2 ? 'text-title' : 'text-body')}
        >
          {inline(heading[2] ?? '', key)}
        </p>,
      );
      i++;
      continue;
    }
    if (line.trim().startsWith('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) {
      const head = cells(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|'))
        body.push(cells(lines[i++] ?? ''));
      blocks.push(
        <div key={key} className="overflow-x-auto">
          <table className="border-collapse text-body-sm">
            <thead>
              <tr>
                {head.map((cell, c) => (
                  <th key={c} className="border border-line px-2 py-1 text-left font-semibold">
                    {inline(cell, `${key}h${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="border border-line px-2 py-1 align-top">
                      {inline(cell, `${key}r${r}c${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const bullet = /^\s*([-*•]|\d+[.)])\s+/;
    if (bullet.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && bullet.test(lines[i] ?? ''))
        items.push((lines[i++] ?? '').replace(bullet, ''));
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={key} className={cx('grid gap-1 pl-5', ordered ? 'list-decimal' : 'list-disc')}>
          {items.map((item, j) => (
            <li key={j}>{inline(item, `${key}-${j}`)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() &&
      !bullet.test(lines[i] ?? '') &&
      !/^(#{1,4})\s/.test(lines[i] ?? '') &&
      !(lines[i] ?? '').startsWith('```')
    )
      paragraph.push(lines[i++] ?? '');
    blocks.push(
      <p key={key}>
        {paragraph.map((part, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(part, `${key}-${j}`)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className="flex flex-col gap-3">{blocks}</div>;
}
