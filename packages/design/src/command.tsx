import { Command } from 'cmdk';
import { useEffect, type ReactNode } from 'react';
import { cx } from './components.js';
import { Icon, type IconName } from './workspace.js';

// The command palette (Ctrl K): one field to search, ask and act — built on cmdk, which filters,
// ranks and moves through the items with the keyboard. Every word comes through props.

/** Ctrl K (⌘K on a Mac) calls `onOpen`, from anywhere on the page. */
export function useCommandShortcut(onOpen: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen]);
}

/** The bar at the top of every screen that opens the palette: a field's look, its shortcut. */
export function CommandTrigger({
  label,
  shortcut = 'Ctrl K',
  onOpen,
}: {
  label: string;
  shortcut?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-keyshortcuts="Control+K"
      className="flex h-[38px] w-full max-w-[520px] items-center gap-3 rounded-control border border-line bg-surface px-3 text-left text-fg-muted transition-colors duration-150 hover:border-line-strong"
    >
      <span className="inline-flex shrink-0">
        <Icon name="sparkle" size={18} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <kbd className="rounded-[3px] border border-line px-1.5 font-number text-[11px] text-fg-muted">
        {shortcut}
      </kbd>
    </button>
  );
}

export interface CommandItem {
  id: string;
  label: string;
  /** A second line, muted. */
  hint?: string;
  icon?: IconName;
  /** More words that find it. */
  keywords?: string[];
  href?: string;
  onSelect?: () => void;
}

export interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

const itemClassName =
  'flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 text-fg data-[selected=true]:bg-surface-selected';

/**
 * The palette: a field, then `answer` when there is one (what the assistant says, with its
 * sources), then « ask » with the words typed, then the groups — places, records, actions — that
 * match them.
 */
export function CommandPalette({
  open,
  onOpenChange,
  label,
  placeholder,
  emptyLabel,
  query,
  onQueryChange,
  groups,
  ask,
  answer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The dialog's accessible name. */
  label: string;
  placeholder: string;
  /** Said when nothing matches and nothing can be asked. */
  emptyLabel: string;
  query: string;
  onQueryChange: (query: string) => void;
  groups: CommandGroup[];
  /** Asking the assistant: its heading, the item's words for a query, and what it does. */
  ask?: { heading: string; label: (query: string) => string; onAsk: (query: string) => void };
  /** The answer to the last question, under the field. */
  answer?: ReactNode;
}) {
  const go = (item: CommandItem) => {
    onOpenChange(false);
    if (item.onSelect) item.onSelect();
    else if (item.href) window.location.href = item.href;
  };
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={label}
      overlayClassName="fixed inset-0 z-20 bg-black/50"
      contentClassName={cx(
        'fixed top-[12vh] left-1/2 z-30 w-[calc(100%-32px)] max-w-[640px] -translate-x-1/2',
        'overflow-hidden rounded-overlay border border-line-overlay bg-surface-raised text-fg shadow-[0_16px_48px_#0006]',
        'max-[760px]:top-3',
      )}
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <span className="inline-flex shrink-0 text-accent">
          <Icon name="sparkle" />
        </span>
        <Command.Input
          value={query}
          onValueChange={onQueryChange}
          placeholder={placeholder}
          className="h-14 w-full border-0 bg-transparent text-fg outline-0 placeholder:text-fg-muted"
        />
      </div>
      {answer && (
        <div className="max-h-[45vh] overflow-y-auto border-b border-line p-4">{answer}</div>
      )}
      <Command.List className="max-h-[50vh] overflow-y-auto p-2">
        <Command.Empty className="p-4 text-body-sm text-fg-muted">{emptyLabel}</Command.Empty>
        {ask && query.trim() && (
          <Command.Group
            heading={ask.heading}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-label-caps [&_[cmdk-group-heading]]:text-fg-muted"
          >
            <Command.Item
              value={`ask ${query}`}
              forceMount
              onSelect={() => ask.onAsk(query.trim())}
              className={itemClassName}
            >
              <span className="inline-flex shrink-0 text-accent">
                <Icon name="sparkle" />
              </span>
              <span className="min-w-0 flex-1 truncate">{ask.label(query.trim())}</span>
              <kbd className="font-number text-[11px] text-fg-muted">↵</kbd>
            </Command.Item>
          </Command.Group>
        )}
        {groups.map((group) =>
          group.items.length === 0 ? null : (
            <Command.Group
              key={group.heading}
              heading={group.heading}
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-label-caps [&_[cmdk-group-heading]]:text-fg-muted"
            >
              {group.items.map((item) => (
                <Command.Item
                  key={item.id}
                  value={`${item.id} ${item.label}`}
                  keywords={item.keywords ?? (item.hint ? [item.hint] : [])}
                  onSelect={() => go(item)}
                  className={itemClassName}
                >
                  {item.icon && (
                    <span className="inline-flex shrink-0 text-fg-muted">
                      <Icon name={item.icon} />
                    </span>
                  )}
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate">{item.label}</span>
                    {item.hint && (
                      <span className="truncate text-body-sm text-fg-muted">{item.hint}</span>
                    )}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          ),
        )}
      </Command.List>
    </Command.Dialog>
  );
}
