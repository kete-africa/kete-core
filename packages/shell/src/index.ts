// The public entry point of @kete/shell. Anything not exported here is internal.
export {
  AppFrame,
  type FrameApps,
  NoteDialog,
  SyncPill,
  type ShellWords,
  type SyncState,
} from './frame.js';
export {
  allPlaces,
  placesFor,
  type Lang,
  type ManifestPlace,
  type Place,
  type PlaceSection,
} from './places.js';
export { FieldFrame, MorningPile, useSunlight, type PileItem } from './phone.js';
