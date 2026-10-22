import { CanvasIcon, type CanvasIconName } from '@kete/design';
import { useState, type ReactNode } from 'react';
import type { MediaView } from './types.js';
import type { ConversationWords } from './words.js';

// « Infos du fil », as on WhatsApp (spec 140; canvas v6.2): search in the thread, her notification
// level, then what it holds — pins, photos and videos, documents and their versions, links, voice
// notes —, and what only Kete has: its actions and its decisions; its members. Each item opens the
// message where it was posted.

type Category =
  'pins' | 'photos' | 'documents' | 'links' | 'voices' | 'actions' | 'decisions' | 'members';

export interface ThreadInfoProps {
  words: ConversationWords;
  media: MediaView | null;
  /** Where a file is read; where a message of the thread opens. */
  fileHref: (fileId: string) => string;
  messageHref: (messageId: string) => string;
  level: 'all' | 'mentions' | 'none';
  onLevel: (level: 'all' | 'mentions' | 'none') => void;
  onSearch?: (text: string) => void;
  /** The product's own: the thread's actions, its decisions, its members. */
  actions?: { count: string; node: ReactNode };
  decisions?: { count: string; node: ReactNode };
  members?: { count: string; node: ReactNode };
  onState?: () => void;
}

const icons: Record<Category, CanvasIconName> = {
  pins: 'pin',
  photos: 'image',
  documents: 'doc',
  links: 'link',
  voices: 'mic',
  actions: 'ok',
  decisions: 'shield',
  members: 'people',
};

export function ThreadInfo({
  words,
  media,
  fileHref,
  messageHref,
  level,
  onLevel,
  onSearch,
  actions,
  decisions,
  members,
  onState,
}: ThreadInfoProps) {
  const [open, setOpen] = useState<Category>('photos');
  const [query, setQuery] = useState('');
  const counts: Record<Category, string | null> = {
    pins: media ? String(media.pins.length) : null,
    photos: media ? String(media.photos.length) : null,
    documents: media ? String(media.documents.length) : null,
    links: media ? String(media.links.length) : null,
    voices: media ? String(media.voices.length) : null,
    actions: actions?.count ?? null,
    decisions: decisions?.count ?? null,
    members: members?.count ?? null,
  };
  const shown = (Object.keys(icons) as Category[]).filter((key) => counts[key] !== null);
  const row = (
    key: string,
    href: string,
    icon: CanvasIconName,
    label: ReactNode,
    side?: ReactNode,
  ) => (
    <li key={key}>
      <a
        href={href}
        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t border-line py-1.5 text-[12.5px] first:border-t-0 hover:text-link"
      >
        <CanvasIcon name={icon} size={14} />
        <span className="truncate">{label}</span>
        {side ?? <span />}
      </a>
    </li>
  );
  const body = (): ReactNode => {
    if (open === 'actions') return actions?.node;
    if (open === 'decisions') return decisions?.node;
    if (open === 'members') return members?.node;
    if (!media) return null;
    if (open === 'photos') {
      return media.photos.length === 0 ? (
        <p className="text-[12.5px] text-fg-muted">{words.nothingHere}</p>
      ) : (
        <span className="grid grid-cols-3 gap-1">
          {media.photos.map((photo) => (
            <a
              key={photo.file}
              href={messageHref(photo.message)}
              title={photo.name}
              className="block h-[74px] overflow-hidden rounded-[6px] bg-surface-selected"
            >
              {photo.mediaType?.startsWith('image/') ? (
                <img
                  src={fileHref(photo.file)}
                  alt={photo.name}
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <span className="grid size-full place-items-center text-fg-muted">
                  <CanvasIcon name="play" size={18} />
                </span>
              )}
            </a>
          ))}
        </span>
      );
    }
    const list =
      open === 'documents'
        ? media.documents.map((d) =>
            row(
              d.file,
              fileHref(d.file),
              'doc',
              d.name,
              <span className="text-[11px] text-fg-muted">{words.version(d.version)}</span>,
            ),
          )
        : open === 'links'
          ? media.links.map((l) => row(`${l.message}-${l.url}`, l.url, 'link', l.url))
          : open === 'voices'
            ? media.voices.map((v) =>
                row(
                  v.file,
                  messageHref(v.message),
                  'mic',
                  v.transcript ?? v.name,
                  <span className="text-[11px] text-fg-muted">{words.time(v.at)}</span>,
                ),
              )
            : media.pins.map((p) =>
                row(p.message, messageHref(p.message), 'pin', words.time(p.at)),
              );
    return list.length === 0 ? (
      <p className="text-[12.5px] text-fg-muted">{words.nothingHere}</p>
    ) : (
      <ul className="grid list-none">{list}</ul>
    );
  };
  return (
    <div className="grid content-start gap-3.5">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-[15px] font-semibold">{words.infos}</h3>
        {onState && (
          <button
            type="button"
            onClick={onState}
            className="inline-flex h-[26px] items-center gap-1 rounded-[5px] border border-line-control px-2 text-[12px] font-semibold hover:bg-surface-hover"
          >
            <CanvasIcon name="layers" size={13} />
            {words.state}
          </button>
        )}
      </div>
      {onSearch && (
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim()) onSearch(query.trim());
          }}
        >
          <label className="relative block">
            <span className="sr-only">{words.searchThread}</span>
            <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-fg-muted">
              <CanvasIcon name="search" size={14} />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={words.searchThread}
              className="h-[30px] w-full rounded-[6px] border border-line-control bg-surface-control pr-2 pl-7 text-[12.5px]"
            />
          </label>
        </form>
      )}
      <div>
        <h4 className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-fg-muted uppercase">
          {words.notifications}
        </h4>
        <div
          role="group"
          aria-label={words.notifications}
          className="inline-flex gap-0.5 rounded-[6px] border border-line-control bg-surface-control p-0.5"
        >
          {(['all', 'mentions', 'none'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={level === value}
              onClick={() => onLevel(value)}
              className="h-[26px] rounded-[4px] px-2.5 text-[12.5px] font-semibold text-fg-muted aria-pressed:bg-surface-selected aria-pressed:text-fg"
            >
              {words.notifyLevel[value]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11.5px] text-fg-muted">{words.notifyHint}</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {shown.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={open === key}
            onClick={() => setOpen(key)}
            className="flex items-center gap-1.5 rounded-[7px] border border-line bg-canvas px-2 py-2 text-left text-[12.5px] font-semibold hover:border-line-strong aria-pressed:border-accent"
          >
            <CanvasIcon name={icons[key]} size={14} />
            <span className="min-w-0 flex-1 truncate">{words.categories[key]}</span>
            <b className="font-number text-[12px] font-semibold text-fg-soft">{counts[key]}</b>
          </button>
        ))}
      </div>
      <div>{body()}</div>
    </div>
  );
}
