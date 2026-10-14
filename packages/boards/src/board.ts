import type { Period } from '@kete/metrics';
import type { Routine } from './routine.js';

// A board (spec 103; doctrine D-052): one object, looked at live, sent by a routine, frozen as a
// summary. Its cards name the apps' declared figures — never a query — or carry her own note; each
// has a place on twelve columns, and a phone reads them in the same order, one under the other.

/** Where a card sits: on twelve columns, rows of one unit. */
export interface Place {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const COLUMNS = 12;

/** A figure of an app, as the board shows it. */
export interface FigureCard {
  id: string;
  kind: 'figure';
  /** The app it comes from, as the center names it: `kete-finance`. */
  app: string;
  /** The figure, as the app declares it: `finance.available`. */
  name: string;
  view: 'figure' | 'line' | 'bar' | 'table';
  place: Place;
  /** Her own title, instead of the figure's. */
  title?: string;
  /** A value to reach; whether higher or lower is better is the figure's. */
  goal?: number;
  /** Past it, the figure says so. */
  threshold?: number;
  /** Put there by the assistant: hers to keep or remove. */
  proposed?: boolean;
}

/** Her own words on the board: for the committee, for herself. */
export interface NoteCard {
  id: string;
  kind: 'note';
  title: string;
  text: string;
  place: Place;
  proposed?: boolean;
}

export type Card = FigureCard | NoteCard;

export interface Board {
  id: string;
  title: string;
  cards: Card[];
  /** The period it opens on; the reader changes it, not for the others. */
  period: Period;
  compare: boolean;
  /** When a routine sends it — and freezes it as a summary. */
  routine?: Routine;
  /** Whether its summaries are indexed, for the assistant and the search: her choice. */
  indexed?: boolean;
}

const fits = (place: Place) => ({
  w: Math.min(Math.max(Math.round(place.w), 1), COLUMNS),
  h: Math.max(Math.round(place.h), 1),
});

const meet = (a: Place, b: Place) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The cards in places that hold: inside twelve columns, none over another, none floating — each
 * moved up as far as it goes, in reading order.
 */
export function arrange<T extends { place: Place }>(cards: readonly T[]): T[] {
  const ordered = [...cards].sort((a, b) => a.place.y - b.place.y || a.place.x - b.place.x);
  const placed: T[] = [];
  for (const card of ordered) {
    const { w, h } = fits(card.place);
    const x = Math.min(Math.max(Math.round(card.place.x), 0), COLUMNS - w);
    let y = 0;
    while (placed.some((other) => meet({ x, y, w, h }, other.place))) y += 1;
    placed.push({ ...card, place: { x, y, w, h } });
  }
  return placed;
}

/** The order a phone reads the cards in: row by row, left to right. */
export function readingOrder<T extends { place: Place }>(cards: readonly T[]): T[] {
  return [...cards].sort((a, b) => a.place.y - b.place.y || a.place.x - b.place.x);
}

/** The place of a new card: under the others, at the left. */
export function placeNew(
  cards: readonly { place: Place }[],
  size: { w: number; h: number },
): Place {
  const bottom = Math.max(0, ...cards.map((card) => card.place.y + card.place.h));
  return { x: 0, y: bottom, ...fits({ x: 0, y: 0, ...size }) };
}
