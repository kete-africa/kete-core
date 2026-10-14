import {
  applyTheme,
  Button,
  CommandPalette,
  CommandTrigger,
  CountBadge,
  Dialog,
  Icon,
  IconButton,
  isIconName,
  NavItem,
  NavSection,
  Shell,
  TabBar,
  TabBarItem,
  TextAreaField,
  ThemeChoice,
  useCommandShortcut,
  type CommandGroup,
  type CommandItem,
  type IconName,
  type ThemeChoiceValue,
} from '@kete/design';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { allPlaces, type Place, type PlaceSection } from './places.js';

// The frame every Kete product wears (spec 100; doctrine D-042, D-045, D-050 to D-054): the same
// in the center and in every app. Its places come from the app's manifest; « Demander » opens the
// drawer beside the page (filled by @kete/intelligence); « Noter » works from every page; the
// phone has its tabs. Every word comes through `words`, from the product's catalogs.

/** Every word the frame shows, from the product's catalogs. */
export interface ShellWords {
  /** The main navigation's accessible name, and the buttons that show and hide it. */
  nav: string;
  showNav: string;
  hideNav: string;
  /** The bar that opens Ctrl K, and the palette's own words. */
  search: string;
  palette: string;
  palettePlaceholder: string;
  paletteEmpty: string;
  palettePlaces: string;
  paletteFound: string;
  paletteAsk: string;
  paletteAskItem: (question: string) => string;
  /** « Demander », « Fichiers », « Noter », the notifications, the phone's tabs. */
  ask: string;
  files: string;
  note: string;
  bell: string;
  tabs: string;
  menu: string;
  /** The note's dialog. */
  noteTitle: string;
  noteField: string;
  noteHint: string;
  noteSave: string;
  /** Closing a dialog or the drawer. */
  close: string;
  /** The person's mode. */
  theme: string;
  themes: { dark: string; light: string; auto: string };
  signOut: string;
  /** The state of synchronization: up to date, offline with what waits, sending. */
  sync: { ok: string; offline: (pending: number) => string; sending: string };
}

/** Where the app stands with its center: up to date, offline with gestures waiting, sending. */
export type SyncState =
  { state: 'ok' } | { state: 'offline'; pending: number } | { state: 'sending' };

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

function iconOf(place: Place): IconName | undefined {
  return place.icon && isIconName(place.icon) ? place.icon : undefined;
}

/** A pill that says whether the gestures reached the center. */
export function SyncPill({ sync, words }: { sync: SyncState; words: ShellWords['sync'] }) {
  const text =
    sync.state === 'ok'
      ? words.ok
      : sync.state === 'offline'
        ? words.offline(sync.pending)
        : words.sending;
  const dot =
    sync.state === 'ok'
      ? 'bg-state-success'
      : sync.state === 'offline'
        ? 'bg-state-verify'
        : 'bg-state-info motion-safe:animate-pulse';
  return (
    <span
      role="status"
      data-sync={sync.state}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line-control px-2.5 text-body-sm whitespace-nowrap text-fg-soft"
    >
      <span aria-hidden="true" className={`inline-block size-2 rounded-full ${dot}`} />
      {text}
    </span>
  );
}

/** « Noter »: a note from any page, kept by the product; Kete understands it afterwards. */
export function NoteDialog({
  open,
  onClose,
  onSave,
  words,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * Keeps the note. What it returns — « Gardée ; rappel jeudi 9 h », with its undo — is shown under
   * the field and the dialog stays open; nothing returned closes it.
   */
  onSave: (text: string) => Promise<ReactNode | void>;
  words: Pick<ShellWords, 'noteTitle' | 'noteField' | 'noteHint' | 'noteSave' | 'close'>;
}) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState<ReactNode>(null);
  return (
    <Dialog open={open} onClose={onClose} title={words.noteTitle} closeLabel={words.close}>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const kept = text.trim();
          if (!kept) return;
          setSaving(true);
          setSaid(null);
          void onSave(kept)
            .then((answer) => {
              setText('');
              if (answer === undefined || answer === null) onClose();
              else setSaid(answer);
            })
            .finally(() => setSaving(false));
        }}
      >
        <TextAreaField
          label={words.noteField}
          hint={words.noteHint}
          value={text}
          rows={4}
          maxLength={4000}
          onChange={setText}
        />
        <div>
          <Button type="submit" disabled={saving || !text.trim()}>
            {words.noteSave}
          </Button>
        </div>
        {said && <div role="status">{said}</div>}
      </form>
    </Dialog>
  );
}

/**
 * The drawer beside the page: « Demander » and « Fichiers » live there and keep the page in view;
 * full screen on a phone. Its content comes from the product (@kete/intelligence).
 */
export function Beside({
  open,
  label,
  closeLabel,
  onClose,
  children,
}: {
  open: boolean;
  label: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <aside
      aria-label={label}
      className="fixed inset-y-0 right-0 z-30 flex w-[min(440px,100vw)] flex-col border-l border-line bg-surface text-fg shadow-[-8px_0_24px_#0004]"
    >
      <div className="flex h-[54px] shrink-0 items-center justify-end border-b border-line px-2">
        <IconButton label={closeLabel} onClick={onClose}>
          <Icon name="close" />
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </aside>
  );
}

/**
 * The frame of every signed-in screen. Its places come from the manifest (`placesFor`); `current`
 * names the place shown. With `onAsk`, « Demander » (Ctrl J, and Ctrl K's question) opens `beside`;
 * with `onNote`, « Noter » (N) opens its dialog anywhere.
 */
export function AppFrame({
  brand,
  sections,
  current,
  counts = {},
  person,
  words,
  find,
  onAsk,
  beside,
  onFiles,
  onNote,
  sync,
  bell,
  tabs = [],
  signOutHref,
  tools,
  children,
}: {
  brand: ReactNode;
  sections: readonly PlaceSection[];
  current?: string;
  /** What waits in each place, by its id. */
  counts?: Record<string, number>;
  person: { name: string; detail?: string };
  words: ShellWords;
  /** What Ctrl K finds beyond the places, under her rights: records, people, documents. */
  find?: (query: string) => Promise<CommandItem[]>;
  /** Ask a question; with none, open the drawer. */
  onAsk?: (question?: string) => void;
  /** The drawer beside the page, when the product opened it. */
  beside?: { open: boolean; label: string; onClose: () => void; content: ReactNode };
  onFiles?: () => void;
  /** Keeps a note; what it returns is shown in the dialog (see `NoteDialog`). */
  onNote?: (text: string) => Promise<ReactNode | void>;
  sync?: SyncState;
  bell?: { href: string; count?: number };
  /** The ids of up to four places on the phone's tabs; « Demander » sits in the middle. */
  tabs?: readonly string[];
  signOutHref?: string;
  /** More of the product's own controls in the toolbar (the feedback button). */
  tools?: ReactNode;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<ThemeChoiceValue>('auto');
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<CommandItem[]>([]);
  const [noting, setNoting] = useState(false);
  const places = allPlaces(sections);

  const openPalette = useCallback(() => setPalette(true), []);
  useCommandShortcut(openPalette);
  useEffect(() => {
    const shown = document.documentElement.getAttribute('data-theme');
    if (shown === 'dark' || shown === 'light' || shown === 'auto') setTheme(shown);
  }, []);
  // Ctrl J asks; N notes, when she is not typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName));
      if (onAsk && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        onAsk();
      }
      if (onNote && !typing && !event.ctrlKey && !event.metaKey && event.key === 'n') {
        event.preventDefault();
        setNoting(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAsk, onNote]);
  useEffect(() => {
    if (!find || !palette || query.trim().length < 2) {
      setFound([]);
      return;
    }
    const timer = setTimeout(() => {
      void find(query)
        .then(setFound)
        .catch(() => setFound([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [find, palette, query]);

  const groups: CommandGroup[] = [
    ...(found.length > 0 ? [{ heading: words.paletteFound, items: found }] : []),
    {
      heading: words.palettePlaces,
      items: places.map((place) => {
        const icon = iconOf(place);
        return { id: place.id, label: place.label, href: place.href, ...(icon ? { icon } : {}) };
      }),
    },
  ];
  const tabPlaces = tabs
    .map((id) => places.find((place) => place.id === id))
    .filter((place): place is Place => Boolean(place))
    .slice(0, 4);
  const half = Math.ceil(tabPlaces.length / 2);
  const tab = (place: Place) => (
    <TabBarItem
      key={place.id}
      href={place.href}
      icon={iconOf(place) ?? 'apps'}
      current={place.id === current}
      {...(counts[place.id] ? { count: counts[place.id] } : {})}
    >
      {place.label}
    </TabBarItem>
  );

  return (
    <>
      <Shell
        brand={brand}
        navLabel={words.nav}
        showNavLabel={words.showNav}
        hideNavLabel={words.hideNav}
        search={<CommandTrigger label={words.search} onOpen={openPalette} />}
        nav={sections.map((section, index) => (
          <NavSection key={index} {...(section.label ? { label: section.label } : {})}>
            {section.places.map((place) => {
              const icon = iconOf(place);
              return (
                <NavItem
                  key={place.id}
                  href={place.href}
                  current={place.id === current}
                  {...(icon ? { icon } : {})}
                  {...(counts[place.id] ? { count: counts[place.id] } : {})}
                >
                  {place.label}
                </NavItem>
              );
            })}
          </NavSection>
        ))}
        toolbar={
          <div className="flex items-center gap-1">
            {sync && <SyncPill sync={sync} words={words.sync} />}
            {tools}
            {onNote && (
              <IconButton label={words.note} onClick={() => setNoting(true)}>
                <Icon name="pen" />
              </IconButton>
            )}
            {onAsk && (
              <Button
                variant="secondary"
                onClick={() => onAsk()}
                aria-keyshortcuts="Control+J"
                // On a phone, « Demander » sits in the middle of the tabs.
                {...(tabPlaces.length > 0 ? { className: 'max-[760px]:hidden' } : {})}
              >
                <Icon name="sparkle" size={18} />
                {words.ask}
              </Button>
            )}
            {onFiles && (
              <IconButton label={words.files} onClick={onFiles}>
                <Icon name="attach" />
              </IconButton>
            )}
            {bell && (
              <a
                href={bell.href}
                aria-label={bell.count ? `${words.bell} (${bell.count})` : words.bell}
                title={words.bell}
                className="relative inline-flex size-(--icon-button-size) items-center justify-center rounded-control text-fg hover:bg-surface-hover"
              >
                <Icon name="bell" />
                {bell.count !== undefined && bell.count > 0 && (
                  <CountBadge count={bell.count} floating />
                )}
              </a>
            )}
          </div>
        }
        footer={
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-action text-[13px] font-semibold text-on-action"
              >
                {initials(person.name)}
              </span>
              <span className="grid min-w-0">
                <span className="truncate font-semibold">{person.name}</span>
                {person.detail && (
                  <span className="truncate text-body-sm text-fg-muted">{person.detail}</span>
                )}
              </span>
            </div>
            <ThemeChoice
              label={words.theme}
              value={theme}
              labels={words.themes}
              onChange={(choice) => {
                setTheme(choice);
                applyTheme(choice);
              }}
            />
            {signOutHref && (
              <a href={signOutHref} className="text-body-sm text-link underline">
                {words.signOut}
              </a>
            )}
          </div>
        }
        {...(tabPlaces.length > 0
          ? {
              tabBar: (
                <TabBar label={words.tabs}>
                  {tabPlaces.slice(0, half).map(tab)}
                  {onAsk && (
                    <TabBarItem icon="sparkle" primary onClick={() => onAsk()}>
                      {words.ask}
                    </TabBarItem>
                  )}
                  {tabPlaces.slice(half).map(tab)}
                </TabBar>
              ),
            }
          : {})}
      >
        {children}
      </Shell>
      <CommandPalette
        open={palette}
        onOpenChange={(next) => {
          setPalette(next);
          if (!next) setQuery('');
        }}
        label={words.palette}
        placeholder={words.palettePlaceholder}
        emptyLabel={words.paletteEmpty}
        query={query}
        onQueryChange={setQuery}
        groups={groups}
        {...(onAsk
          ? {
              ask: {
                heading: words.paletteAsk,
                label: words.paletteAskItem,
                onAsk: (question: string) => {
                  setPalette(false);
                  setQuery('');
                  onAsk(question);
                },
              },
            }
          : {})}
      />
      {onNote && (
        <NoteDialog open={noting} onClose={() => setNoting(false)} onSave={onNote} words={words} />
      )}
      {beside && (
        <Beside
          open={beside.open}
          label={beside.label}
          closeLabel={words.close}
          onClose={beside.onClose}
        >
          {beside.content}
        </Beside>
      )}
    </>
  );
}
