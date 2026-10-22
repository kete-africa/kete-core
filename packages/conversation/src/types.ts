import type { Message } from '@kete/sdk';

// What the threads' screen shows (spec 140, FR-019): the same shapes as `@kete/threads` gives them,
// so a product passes its center's answers through. Every word comes through `ConversationWords`.

export interface Who {
  kind: 'person' | 'agent' | 'contact';
  id: string;
}

/** A message as a thread shows it (`@kete/threads`' `Shown`). */
export type ShownMessage = Message & {
  first: string;
  edits: number;
  readBy: { kind: Who['kind']; id: string; at: string }[];
  movedTo?: { thread: string; message: string; at: string };
  reactions: { emoji: string; by: { kind: Who['kind']; id: string }[] }[];
  pinned?: { by: { kind: Who['kind']; id: string }; at: string };
  deleted?: { by: { kind: Who['kind']; id: string }; at: string };
  imported?: true;
  sharedAs?: string;
};

/** One step of a turn of Kete or an agent, as the canvas folds it. */
export interface RunStep {
  state: 'done' | 'now' | 'todo' | 'ask';
  label: string;
  /** Its level or kind: « lire », « brouillon », « politique »… */
  tag?: string;
}

/** A turn of Kete or an agent shown in a message (FR-019): its plan, folded once finished. */
export interface RunView {
  title: string;
  /** « 3 min · 5 étapes », « travaille… » */
  meta: string;
  steps: RunStep[];
  /** What it does now, while it works. */
  live?: string;
  onStop?: () => void;
}

/** A thread in the list. */
export interface ListItem {
  id: string;
  href: string;
  title: string;
  /** What shows before the title: the object's initials, « # », an avatar. */
  badge?: { text: string; tone?: 'object' | 'group' | 'agent' | 'party' | 'muted' };
  /** Its last words, as « Yao : … ». */
  last?: string;
  /** Its last activity, already said for her (« 7 h 41 », « 12 oct. »). */
  when?: string;
  unread?: number;
  /** For an agent: needs her, works, has finished, idle. */
  state?: 'needs' | 'working' | 'finished' | 'idle';
  resolved?: boolean;
}

/** What a thread holds, as « Infos du fil » lists it (`@kete/threads`' `mediaOf`). */
export interface MediaView {
  photos: { file: string; name: string; mediaType: string | null; message: string; at: string }[];
  documents: { file: string; name: string; message: string; at: string; version: number }[];
  links: { url: string; message: string; at: string }[];
  voices: {
    file: string;
    name: string;
    message: string;
    at: string;
    durationMs: number | null;
    transcript: string | null;
  }[];
  pins: { message: string; at: string }[];
}
