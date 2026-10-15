# @kete-africa/intelligence

## 0.3.0

### Minor Changes

- `renderAfter` shows what a product adds after an answer's words (a table, an app's view); a
  capability's row names it as the canvas does, its technical name in mono, her words in its title.
- `useIntelligence(ask, initial)` opens a thread again with its answered turns.

## 0.2.0

### Minor Changes

- The frame and Kete Intelligence of the validated canvas v3.1 (spec 108): `CanvasFrame` and its
  `Frame*` parts, `CanvasIcon`, `FramePage` and `FramePageHead`, the canvas's `VerificationCard`, `KpiTile`
  and `ghost` button in `@kete/design`; `AppFrame` on them, with the app's head, what waits in each
  place, the apps at the bottom and the page « Demander » on a phone; the drawer's head, context, scope,
  plan, capabilities with what they were called with, drafts as their card, « Régénérer » and tally.
  The template wears them.

## 0.1.0

### Minor Changes

- Kete Intelligence (spec 101): `@kete-africa/intelligence` streams a turn of the agents' runtime as the contract `intelligence-event.v1` and draws it in the drawer beside the page — status, plan, each capability with its level, the words as they come, drafts, sources, « Arrêter ». `@kete-africa/agents` says each capability as it starts (`calling`). The contract accepts a product's own addresses for a draft and a source. The template's page « Demander » becomes the drawer.
