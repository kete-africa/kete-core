# @kete-africa/shell

## 0.4.1

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.4.0

### Minor Changes

- 72aee61: Settings in layers (spec 115): `@kete/settings` 0.1.0 — declared once, resolved from Kete's default
  through the organization, the app, the entity and the person to the device, journaled; the frame
  says a theme choice (`onTheme`) so the product saves it as her preference; a new app reads its
  settings through the module and its theme and language follow the person.
- f251c61: « Réglages » (spec 116): `@kete/shell` draws the same settings page in every app from the
  declarations (`SettingsPanel`, `controlOf`, `sayValue`) — her preferences first, then the
  organization's, each value with where it comes from; a declaration says the words of its choices
  (`choices`); a new app has « Réglages » at the foot of its places, her preferences saved in the
  Compte Kete and the app's settings journaled under `settings:manage`.

## 0.3.0

### Minor Changes

- The frame and Kete Intelligence of the validated canvas v3.1 (spec 108): `CanvasFrame` and its
  `Frame*` parts, `CanvasIcon`, `FramePage` and `FramePageHead`, the canvas's `VerificationCard`, `KpiTile`
  and `ghost` button in `@kete/design`; `AppFrame` on them, with the app's head, what waits in each
  place, the apps at the bottom and the page « Demander » on a phone; the drawer's head, context, scope,
  plan, capabilities with what they were called with, drafts as their card, « Régénérer » and tally.
  The template wears them.

## 0.2.0

### Minor Changes

- The phone (spec 106, step L8). `@kete-africa/shell` adds the morning's pile (`MorningPile`), the
  field mode « Terrain » (`FieldFrame`) and `useSunlight`. `@kete-africa/design` generates « Plein
  soleil » for every design — `data-sun="on"`, the light mode at its strongest, its contrasts checked.
- `onNote` may return what to show under the note's field — « Gardée ; rappel jeudi 9 h », with its
  undo — and the dialog stays open; nothing returned closes it, as before.

## 0.1.0

### Minor Changes

- The shell (spec 100): `@kete-africa/shell` draws the frame every Kete product wears from the app's manifest — places, Ctrl K, « Demander » beside the page, « Noter », the state of synchronization, the phone's tabs. `@kete-africa/design` gains `DecisionCard`, `Mention`, `AgentRunState` and « Pourquoi ? » under a `KpiTile`; Ctrl K always offers to ask the words typed. The template wears the shell.
