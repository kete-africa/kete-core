import {
  ActorAvatar,
  CanvasIcon,
  Markdown,
  type ActorFace,
  type CanvasIconName,
} from '@kete/design';
import { useRef, useState, type ReactNode } from 'react';
import { AgentRun } from './run.js';
import type { RunView, ShownMessage, Who } from './types.js';
import type { ConversationWords } from './words.js';

// One message as the canvas v6.2 draws it: its author and time, where it came from, the message it
// answers, its words — Markdown for an agent, mentions and « # » citations standing out —, its
// photos, voice notes and files, its links, the turn that wrote it, the product's own blocks, the
// reactions, who read it; on hover, three gestures and « ⋯ ». A message taken back shows only
// that it was; one only for her says why, and offers to share it.

export interface MenuItem {
  id: string;
  label: string;
  icon?: CanvasIconName;
  danger?: boolean;
  onSelect: () => void;
}

export interface MessageProps {
  message: ShownMessage;
  words: ConversationWords;
  me: Who;
  nameOf: (who: { kind: string; id: string }) => string;
  /** An agent's own face, when the product knows it; otherwise one is drawn from its id (R6). */
  faceOf?: (who: { kind: string; id: string }) => ActorFace | null | undefined;
  /** The message it answers, if shown in this page. */
  quoted?: ShownMessage | undefined;
  /** Where a file of the thread is read. */
  fileHref: (fileId: string) => string;
  /** A « # » citation in its state of now (the product reads it with her rights). */
  renderReference?: (reference: { kind: string; id: string; app?: string }) => ReactNode;
  /** How a citation reads in the words, after « # »: its label (default its id). */
  referenceLabel?: (reference: { kind: string; id: string; app?: string }) => string;
  /** The turn of Kete or an agent that wrote it. */
  run?: RunView | null;
  /** The product's blocks: an action and its holder, a message waiting for approval… */
  extras?: ReactNode;
  /** Its first words, before it was edited: the trace keeps them. */
  original?: string | undefined;
  /** What a link shows: its title and where it is, when the product knows it. */
  preview?: (url: string) => { title: string; detail?: string } | null;
  quickEmojis?: string[];
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  onAction?: () => void;
  onShare?: () => void;
  /** What « ⋯ » offers: pin, create, move, edit, delete, mark unread. */
  menu?: MenuItem[];
}

const URL = /\bhttps?:\/\/[^\s<>()«»"']+[^\s<>()«»"'.,;:!?]/g;

/** Its author's face, as everywhere (R6): Kete and an agent a square, a person a circle. */
function Avatar({ name, who, face }: { name: string; who: Who; face?: ActorFace | null }) {
  return (
    <ActorAvatar
      kind={who.kind === 'agent' && who.id === 'agt_assistant' ? 'kete' : who.kind}
      id={who.id}
      name={name}
      face={face ?? null}
    />
  );
}

/** Her words with the people she named and the objects she cited standing out. */
function Words({
  text,
  names,
  references,
  renderReference,
  labelOf,
}: {
  text: string;
  names: string[];
  references: { kind: string; id: string; app?: string }[];
  renderReference: MessageProps['renderReference'];
  labelOf: (reference: { kind: string; id: string; app?: string }) => string;
}) {
  const marks = [
    ...names.map((name) => `@${name}`),
    ...references.map((reference) => `#${labelOf(reference)}`),
  ].sort((a, b) => b.length - a.length);
  if (marks.length === 0) return <>{text}</>;
  const pattern = new RegExp(
    `(${marks.map((mark) => mark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g',
  );
  return (
    <>
      {text.split(pattern).map((part, i) => {
        if (part.startsWith('@') && names.includes(part.slice(1))) {
          return (
            <b key={i} className="rounded-[4px] bg-surface-selected px-0.5 text-link">
              {part}
            </b>
          );
        }
        const cited = references.find((reference) => `#${labelOf(reference)}` === part);
        if (cited && renderReference) return <span key={i}>{renderReference(cited)}</span>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function Voice({
  file,
  href,
  words,
}: {
  file: NonNullable<ShownMessage['attachments']>[number];
  href: string;
  words: ConversationWords;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const seconds = Math.round((file.duration_ms ?? 0) / 1000);
  return (
    <div className="mt-1 grid max-w-[380px] gap-1.5">
      <div className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1 pr-2.5 pl-1">
        <button
          type="button"
          aria-label={words.play}
          aria-pressed={playing}
          onClick={() => {
            const element = audio.current;
            if (!element) return;
            if (element.paused) void element.play();
            else element.pause();
          }}
          className="grid size-8 flex-none place-items-center rounded-full bg-action text-on-action"
        >
          <CanvasIcon name={playing ? 'pause' : 'play'} size={14} />
        </button>
        <span
          aria-hidden="true"
          className="h-5 flex-1 rounded-[2px] bg-[repeating-linear-gradient(90deg,var(--color-fg-soft)_0_2px,transparent_2px_5px)] opacity-45"
        />
        <span className="font-number text-[12px]">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </span>
        <button
          type="button"
          aria-label={words.speed}
          onClick={() => {
            const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
            setRate(next);
            if (audio.current) audio.current.playbackRate = next;
          }}
          className="h-[22px] rounded-[10px] border border-line-control bg-surface-control px-1.5 font-number text-[11px] font-semibold"
        >
          {String(rate).replace('.', ',')}×
        </button>
        <audio
          ref={audio}
          src={href}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      </div>
      {file.transcript && (
        <details className="max-w-[560px] text-[13px] text-fg-soft">
          <summary className="cursor-pointer text-[12px] font-semibold text-fg-muted">
            {words.transcript}
          </summary>
          {file.transcript}
        </details>
      )}
    </div>
  );
}

const isPhoto = (type?: string) =>
  Boolean(type?.startsWith('image/') || type?.startsWith('video/'));
const isVoice = (type?: string) => Boolean(type?.startsWith('audio/'));

export function MessageItem({
  message,
  words,
  me,
  nameOf,
  faceOf,
  quoted,
  fileHref,
  renderReference,
  referenceLabel = (reference) => reference.id,
  run,
  extras,
  original: before,
  preview,
  quickEmojis = [],
  onReact,
  onReply,
  onAction,
  onShare,
  menu = [],
}: MessageProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [original, setOriginal] = useState(false);
  const name = nameOf(message.author) || words.someone;
  const mine = message.author.kind === me.kind && message.author.id === me.id;
  const files = message.attachments ?? [];
  const photos = files.filter((file) => isPhoto(file.media_type));
  const voices = files.filter((file) => isVoice(file.media_type));
  const others = files.filter((file) => !isPhoto(file.media_type) && !isVoice(file.media_type));
  const links = message.deleted ? [] : [...new Set(message.text.match(URL) ?? [])];
  const readers = message.readBy
    .filter((r) => r.id !== message.author.id)
    .map((r) => `${nameOf(r) || words.someone} ${words.time(r.at)}`);
  const via = message.via !== 'kete' ? words.via[message.via] : null;
  const onlyMe = Boolean(message.only_for);
  return (
    <li
      id={message.first}
      data-mine={mine || undefined}
      className="group/message relative grid max-w-[760px] scroll-mt-4 grid-cols-[28px_minmax(0,1fr)] gap-2.5 max-[860px]:grid-cols-[24px_minmax(0,1fr)]"
    >
      <Avatar name={name} who={message.author} face={faceOf?.(message.author) ?? null} />
      <div className="min-w-0">
        {!message.deleted && (onReact || onReply || onAction || menu.length > 0) && (
          <div
            role="toolbar"
            aria-label={words.more}
            data-open={menuOpen || undefined}
            className="absolute -top-4 right-0 z-10 hidden gap-px rounded-[7px] border border-line-strong bg-surface p-0.5 shadow-[0_4px_14px_#0000001f] group-focus-within/message:flex group-hover/message:flex data-[open]:flex"
          >
            {onReact &&
              quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={words.react(emoji)}
                  title={words.react(emoji)}
                  onClick={() => onReact(emoji)}
                  className="grid h-[26px] w-7 place-items-center rounded-[5px] text-[14px] hover:bg-surface-hover"
                >
                  {emoji}
                </button>
              ))}
            {onReact && quickEmojis.length > 0 && (
              <span className="mx-0.5 my-1 w-px bg-line" aria-hidden="true" />
            )}
            {onReply && (
              <button
                type="button"
                aria-label={words.reply}
                title={words.reply}
                onClick={onReply}
                className="grid h-[26px] w-7 place-items-center rounded-[5px] text-fg-soft hover:bg-surface-hover"
              >
                <CanvasIcon name="reply" size={14} />
              </button>
            )}
            {onAction && (
              <button
                type="button"
                aria-label={words.forAction}
                title={words.forAction}
                onClick={onAction}
                className="grid h-[26px] w-7 place-items-center rounded-[5px] text-fg-soft hover:bg-surface-hover"
              >
                <CanvasIcon name="ok" size={14} />
              </button>
            )}
            {menu.length > 0 && (
              <button
                type="button"
                aria-label={words.more}
                aria-expanded={menuOpen}
                title={words.more}
                onClick={() => setMenuOpen((o) => !o)}
                className="grid h-[26px] w-7 place-items-center rounded-[5px] text-fg-soft hover:bg-surface-hover"
              >
                <CanvasIcon name="more" size={14} />
              </button>
            )}
            {menuOpen && (
              <div className="absolute top-8 right-0 grid min-w-[210px] gap-px rounded-[8px] border border-line-strong bg-surface p-1 shadow-[0_10px_30px_#0000002e]">
                {menu.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-danger={item.danger || undefined}
                    onClick={() => {
                      setMenuOpen(false);
                      item.onSelect();
                    }}
                    className="flex h-[30px] items-center gap-2 rounded-[6px] px-2 text-left text-[12.5px] text-fg hover:bg-surface-hover data-[danger]:text-state-error-fg"
                  >
                    {item.icon && <CanvasIcon name={item.icon} size={14} />}
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] text-fg-muted">
          <b className="text-[13.5px] font-semibold text-fg">{name}</b>
          {message.author.kind === 'agent' && (
            <span className="rounded-[4px] bg-agent px-1.5 text-[11px] font-semibold text-on-agent">
              {words.agent}
            </span>
          )}
          <time dateTime={message.at}>{words.time(message.at)}</time>
          {via && (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-state-success-surface px-1.5 text-[11px] font-semibold text-state-success-fg">
              {message.via === 'whatsapp' && <CanvasIcon name="whatsapp" size={11} />}
              {via}
            </span>
          )}
          {message.visibility === 'outside' && message.author.kind !== 'contact' && (
            <span className="rounded-[4px] bg-state-verify-surface px-1.5 text-[11px] font-semibold text-state-verify-fg">
              {words.toClient}
            </span>
          )}
          {onlyMe && (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-state-verify-surface px-1.5 text-[11px] font-semibold text-state-verify-fg">
              <CanvasIcon name="lock" size={11} />
              {words.onlyForYou}
            </span>
          )}
          {message.imported && <span>{words.imported}</span>}
          {message.edits > 0 && !message.deleted && !before && <span>{words.edited}</span>}
          {message.edits > 0 && !message.deleted && before && (
            <button
              type="button"
              onClick={() => setOriginal((o) => !o)}
              className="text-[12px] text-fg-muted underline decoration-dotted"
            >
              {words.edited} · {words.showOriginal}
            </button>
          )}
          {message.moved_from && <span>{words.movedHere}</span>}
        </p>
        {quoted && !message.deleted && (
          <a
            href={`#${quoted.first}`}
            className="mt-1 block max-w-[520px] truncate rounded-[4px] border border-line bg-canvas px-2 py-1 text-[12.5px] text-fg-soft"
          >
            <b className="block text-[12px] text-fg">{nameOf(quoted.author) || words.someone}</b>
            {quoted.deleted ? words.deleted(nameOf(quoted.author)) : quoted.text}
          </a>
        )}
        {message.deleted ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-fg-muted italic">
            <CanvasIcon name="trash" size={13} />
            {words.deleted(nameOf(message.deleted.by) || words.someone)}
          </p>
        ) : (
          <div
            className={
              onlyMe
                ? 'mt-1 grid max-w-[620px] gap-1.5 rounded-[8px] border border-dashed border-line-strong bg-surface p-2.5'
                : ''
            }
          >
            {onlyMe && (
              <p className="flex items-start gap-1.5 text-[12px] text-fg-muted">
                <CanvasIcon name="eye" size={13} />
                {words.onlyForYouWhy}
              </p>
            )}
            {run && <AgentRun run={run} words={words} />}
            {message.text && (
              <div
                className={`mt-0.5 text-[14px] leading-[1.55] text-fg ${
                  message.movedTo ? 'text-fg-muted line-through' : ''
                } ${message.author.kind === 'agent' ? '[&_p]:m-0' : 'whitespace-pre-wrap'}`}
              >
                {message.author.kind === 'agent' ? (
                  <Markdown text={message.text} />
                ) : (
                  <Words
                    text={message.text}
                    names={(message.mentions ?? []).map((who) => nameOf(who)).filter(Boolean)}
                    references={message.references ?? []}
                    renderReference={renderReference}
                    labelOf={referenceLabel}
                  />
                )}
              </div>
            )}
            {original && before && (
              <p className="mt-1 text-[13px] text-fg-muted line-through">{before}</p>
            )}
            {onlyMe && onShare && (
              <p className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onShare}
                  className="inline-flex h-[26px] items-center rounded-[5px] border border-line-control px-2 text-[12px] font-semibold hover:bg-surface-hover"
                >
                  {words.share}
                </button>
              </p>
            )}
          </div>
        )}
        {message.movedTo && (
          <p className="text-[12.5px] font-semibold text-link">{words.movedAway}</p>
        )}
        {!message.deleted && photos.length > 0 && (
          <span className="mt-1.5 grid max-w-[392px] grid-cols-3 gap-1">
            {photos.slice(0, 3).map((file, index) => (
              <a
                key={file.id}
                href={fileHref(file.id)}
                target="_blank"
                rel="noreferrer"
                title={file.name}
                className="relative block h-24 overflow-hidden rounded-[6px] bg-surface-selected"
              >
                {file.media_type?.startsWith('image/') ? (
                  <img
                    src={fileHref(file.id)}
                    alt={file.name}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="grid size-full place-items-center text-fg-muted">
                    <CanvasIcon name="play" size={22} />
                  </span>
                )}
                {index === 2 && photos.length > 3 && (
                  <span className="absolute inset-0 grid place-items-center bg-[#00000073] text-[18px] font-semibold text-surface">
                    +{photos.length - 3}
                  </span>
                )}
              </a>
            ))}
          </span>
        )}
        {!message.deleted &&
          voices.map((file) => (
            <Voice key={file.id} file={file} href={fileHref(file.id)} words={words} />
          ))}
        {!message.deleted && others.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {others.map((file) => (
              <a
                key={file.id}
                href={fileHref(file.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-[24px] items-center gap-1 rounded-[5px] border border-line-control bg-surface px-2 text-[12px] text-fg-soft hover:bg-surface-hover"
              >
                <CanvasIcon name="doc" size={13} />
                {file.name}
              </a>
            ))}
          </span>
        )}
        {links.slice(0, 1).map((url) => {
          const shown = preview?.(url);
          return shown ? (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1.5 grid max-w-[460px] gap-px rounded-[7px] border border-line bg-surface px-2.5 py-1.5 text-[12.5px]"
            >
              <b className="font-semibold">{shown.title}</b>
              {shown.detail && <span className="text-fg-muted">{shown.detail}</span>}
              <small className="font-number text-[11px] text-fg-muted">
                {new globalThis.URL(url).host}
              </small>
            </a>
          ) : null;
        })}
        {extras}
        {message.reactions.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {message.reactions.map((reaction) => {
              const mineToo = reaction.by.some((who) => who.kind === me.kind && who.id === me.id);
              return (
                <button
                  key={reaction.emoji}
                  type="button"
                  aria-pressed={mineToo}
                  title={reaction.by.map((who) => nameOf(who)).join(', ')}
                  onClick={() => onReact?.(reaction.emoji)}
                  className="inline-flex h-6 items-center gap-1 rounded-full border border-line-control bg-surface-control px-2 text-[12px] text-fg-soft aria-pressed:border-accent aria-pressed:text-fg"
                >
                  {reaction.emoji} <span className="font-number">{reaction.by.length}</span>
                </button>
              );
            })}
          </span>
        )}
        {!message.deleted && (readers.length > 0 || mine) && (
          <p className="mt-1 flex items-center gap-1 text-[12px] text-fg-muted">
            {readers.length > 0 && <CanvasIcon name="eye" size={12} />}
            {readers.length > 0 ? words.readBy(readers) : words.sent}
          </p>
        )}
      </div>
    </li>
  );
}
