import {
  applyTheme,
  Button,
  CanvasFrame,
  CanvasIcon,
  CommandPalette,
  Dialog,
  FrameAskButton,
  FrameAvatar,
  FrameIconButton,
  FrameMark,
  FrameNavGroup,
  FrameNavLabel,
  FrameOrg,
  FramePlace,
  FrameSearch,
  FrameSpaceHead,
  FrameTab,
  isCanvasIconName,
  isIconName,
  TextAreaField,
  ThemeChoice,
  useCommandShortcut,
  type CanvasIconName,
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
  /** Her avatar's name: « Profil ». */
  profile: string;
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
  onSave: (text: string) => Promise<ReactNode>;
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

/** A manifest's icon in the canvas's set: its own name, or the one the canvas draws for it. */
const canvasNames: Record<string, CanvasIconName> = {
  check: 'decide',
  calendar: 'cal',
  chart: 'board',
  sparkle: 'spark',
  agent: 'bot',
  list: 'doc',
  file: 'doc',
  tool: 'gear',
  library: 'book',
  close: 'x',
  attach: 'clip',
  chevron: 'down',
  new: 'plus',
};
function canvasIconOf(place: Place): CanvasIconName | undefined {
  if (!place.icon) return undefined;
  if (isCanvasIconName(place.icon)) return place.icon;
  return canvasNames[place.icon];
}

/** The apps of her organization, under « Apps » at the bottom of the places. */
export interface FrameApps {
  label: string;
  items: { id: string; label: string; href: string; color?: string }[];
}

/**
 * The frame of every signed-in screen (the validated canvas v3.1, spec 108): the top bar across the
 * whole width — the brand, her organization, the search, the tools, her avatar — the places on the
 * left with what waits in each, Kete Intelligence's drawer on the right, the phone's five tabs.
 * Its places come from the manifest (`placesFor`); `current` names the place shown.
 */
export function AppFrame({
  brand,
  org,
  space,
  sections,
  foot,
  current,
  counts = {},
  person,
  words,
  find,
  onAsk,
  askHref,
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
  /** Kete, or the product: its name and the letter of its mark. */
  brand: { name: string; mark?: string };
  /** The organization she works in. */
  org?: { name: string; onClick?: () => void };
  /** In an app: its own head — its mark, its color, its question, the way back to the center. */
  space?: {
    name: string;
    mark?: string;
    color?: string;
    question?: string;
    back?: { href: string; label: string };
  };
  sections: readonly PlaceSection[];
  /** The bottom of the places: « Apps », « Toutes les apps », « Administration ». */
  foot?: { apps?: FrameApps; places?: readonly Place[] };
  current?: string;
  /** What waits in each place, by its id: a count said in bold. */
  counts?: Record<string, number>;
  person: { name: string; detail?: string };
  words: ShellWords;
  /** What Ctrl K finds beyond the places, under her rights: records, people, documents. */
  find?: (query: string) => Promise<CommandItem[]>;
  /** Ask a question; with none, open the drawer. */
  onAsk?: (question?: string) => void;
  /** The page « Demander »: the phone's middle tab opens it (its place id is `ask`). */
  askHref?: string;
  /** Kete Intelligence beside the page, when the product opened it: its own header included. */
  beside?: { open: boolean; wide?: boolean; label: string; content: ReactNode };
  onFiles?: () => void;
  /** Keeps a note; what it returns is shown in the dialog (see `NoteDialog`). */
  onNote?: (text: string) => Promise<ReactNode>;
  sync?: SyncState;
  bell?: { href: string; count?: number };
  /** The ids of three places on the phone's tabs: « Demander » sits in the middle, « Menu » last. */
  tabs?: readonly string[];
  signOutHref?: string;
  /** More of the product's own controls in the top bar (the feedback button). */
  tools?: ReactNode;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<ThemeChoiceValue>('auto');
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<CommandItem[]>([]);
  const [noting, setNoting] = useState(false);
  const places = [...allPlaces(sections), ...(foot?.places ?? [])];

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

  const placeLink = (place: Place, main = false) => {
    const icon = canvasIconOf(place);
    const count = counts[place.id];
    const extra =
      place.extra ?? (count ? { kind: 'count' as const, value: count, hot: true } : undefined);
    return (
      <FramePlace
        key={place.id}
        href={place.href}
        current={place.id === current}
        main={main}
        {...(place.dot ? { dot: place.dot } : icon ? { icon } : {})}
        {...(extra ? { extra } : {})}
      >
        {place.label}
      </FramePlace>
    );
  };
  const tabPlaces = tabs
    .map((id) => places.find((place) => place.id === id))
    .filter((place): place is Place => Boolean(place))
    .slice(0, 3);
  const tab = (place: Place) => (
    <FrameTab
      key={place.id}
      href={place.href}
      icon={canvasIconOf(place) ?? 'apps'}
      current={place.id === current}
      {...(counts[place.id] ? { badge: counts[place.id] } : {})}
    >
      {place.label}
    </FrameTab>
  );

  return (
    <>
      <CanvasFrame
        brand={
          <>
            <FrameMark>{brand.mark ?? brand.name.slice(0, 1)}</FrameMark>
            <span>{brand.name}</span>
          </>
        }
        {...(org
          ? { org: <FrameOrg name={org.name} {...(org.onClick ? { onClick: org.onClick } : {})} /> }
          : {})}
        search={<FrameSearch label={words.search} onOpen={openPalette} />}
        tools={
          <>
            {sync && <SyncPill sync={sync} words={words.sync} />}
            {tools}
            {onNote && (
              <FrameIconButton
                label={words.note}
                icon="pen"
                onClick={() => setNoting(true)}
                className="max-[640px]:hidden"
              />
            )}
            {onAsk && (
              <FrameAskButton
                label={words.ask}
                onClick={() => onAsk()}
                {...(beside ? { pressed: beside.open } : {})}
              />
            )}
            {onFiles && <FrameIconButton label={words.files} icon="clip" onClick={onFiles} />}
            {bell && (
              <a
                href={bell.href}
                aria-label={bell.count ? `${words.bell} (${bell.count})` : words.bell}
                title={words.bell}
                className="relative inline-grid size-8 place-items-center rounded-[5px] text-fg-soft hover:bg-surface-hover hover:text-fg max-[640px]:size-10"
              >
                <CanvasIcon name="bell" />
                {bell.count !== undefined && bell.count > 0 && (
                  <span className="absolute -right-0.5 top-0 h-4 min-w-4 rounded-full bg-action px-1 text-[10px] font-bold leading-4 text-on-action shadow-[0_0_0_2px_var(--color-surface)]">
                    {bell.count}
                  </span>
                )}
              </a>
            )}
            <FrameAvatar initials={initials(person.name)} label={words.profile}>
              <div className="grid gap-3">
                <span className="grid min-w-0">
                  <span className="truncate font-semibold">{person.name}</span>
                  {person.detail && (
                    <span className="truncate text-body-sm text-fg-muted">{person.detail}</span>
                  )}
                </span>
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
            </FrameAvatar>
          </>
        }
        navLabel={words.nav}
        menuLabel={words.showNav}
        nav={
          <>
            {space ? (
              <FrameSpaceHead
                mark={space.mark ?? space.name.slice(0, 1)}
                name={space.name}
                {...(space.color ? { color: space.color } : {})}
                {...(space.question ? { question: space.question } : {})}
                {...(space.back ? { back: space.back } : {})}
              />
            ) : (
              <div className="h-2" />
            )}
            {sections.map((section, index) => (
              <div key={index} className="flex flex-col">
                {section.label && <FrameNavLabel>{section.label}</FrameNavLabel>}
                {section.places.map((place) => placeLink(place, !space && index === 0))}
              </div>
            ))}
          </>
        }
        {...(foot
          ? {
              navFoot: (
                <>
                  {foot.apps && (
                    <FrameNavGroup icon="apps" label={foot.apps.label}>
                      {foot.apps.items.map((app) => (
                        <FramePlace key={app.id} href={app.href} sub dot={app.color ?? true}>
                          {app.label}
                        </FramePlace>
                      ))}
                    </FrameNavGroup>
                  )}
                  {(foot.places ?? []).map((place) => placeLink(place))}
                </>
              ),
            }
          : {})}
        {...(beside
          ? {
              drawer: {
                open: beside.open,
                ...(beside.wide ? { wide: true } : {}),
                label: beside.label,
                content: beside.content,
              },
            }
          : {})}
        {...(tabPlaces.length > 0
          ? {
              tabsLabel: words.tabs,
              tabs: (openMenu: () => void) => (
                <>
                  {tabPlaces.slice(0, 2).map(tab)}
                  {askHref ? (
                    <FrameTab icon="spark" raised href={askHref} current={current === 'ask'}>
                      {words.ask}
                    </FrameTab>
                  ) : (
                    onAsk && (
                      <FrameTab icon="spark" raised onClick={() => onAsk()}>
                        {words.ask}
                      </FrameTab>
                    )
                  )}
                  {tabPlaces.slice(2).map(tab)}
                  <FrameTab icon="menu" onClick={openMenu}>
                    {words.menu}
                  </FrameTab>
                </>
              ),
            }
          : {})}
      >
        {children}
      </CanvasFrame>
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
    </>
  );
}
