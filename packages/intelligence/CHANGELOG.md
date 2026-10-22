# @kete-africa/intelligence

## 0.4.0

### Minor Changes

- d2509b9: Threads for everyone (spec 140; doctrine D-061).

  - **`message.v1`** gains `references` (the objects cited with « # »), `only_for` (one reader), and a
    voice note's `duration_ms` and `transcript`.
  - **`holding.v1`** gains `delegate` and `return_to`.
  - **`@kete/threads`** (`threadsComfortMigrationSql`) adds:
    - reactions, pins, and a message taken back (kept in the proof);
    - transcripts that are searched;
    - citations with « Cité dans », threads attached to several objects, and pages of fifty;
    - a message only for one person, and its sharing;
    - notification levels with `whoToTell`, and typing announced;
    - `mediaOf`, files in the product's storage up to 100 MB, WhatsApp and Telegram imports kept
      once, and merged threads.
  - **`@kete/channels`** (`channelsMailRefsMigrationSql`):
    - a reply finds its thread by what it answers;
    - a mailbox is read folder by folder, with the product's rule, and a Sent folder's mail is the
      person's own;
    - a mail is cleaned of what it quotes and of its signature, with its original kept;
    - `fromEml` reads a mail file.
  - **`@kete/work`** (`workDelegatesMigrationSql`): a person holds, an agent is delegated, and the
    result returns.
  - **`@kete/files`**: `diskStorage`.
  - **`@kete/design`**: `MessageField` and `FieldToggle`, the one composer of the canvas v6.2, and the
    canvas v6.2's icons.
  - **`@kete/conversation`** (new): the threads' screen any product shows — `ConversationFrame`,
    `ThreadListPanel`, `ThreadHeader`, `PinBar`, `MessageStream`, `MessageItem`, `AgentRun` and
    `ThreadInfo`.
  - **`@kete/intelligence`**: its `Composer` is `MessageField`.

## 0.3.4

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.3.3

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.3.2

### Patch Changes

- Published again on the current `@kete-africa/ai` and `@kete-africa/agents`.

## 0.3.1

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.3.0

### Minor Changes

- `renderAfter` shows what a product adds after an answer's words (a table, an app's view); a
  capability's row names it as the canvas does, its technical name in mono, her words in its title.
- `useIntelligence(ask, initial)` opens a thread again with its answered turns.
- The field (`Composer`, `composer` in place of `composerTools`): files joined as chips, objects cited
  with @ and gestures asked with / picked from the product's lists, her voice written by the
  browser's speech recognition; `onSend` receives what she picked and kept; `prefill` puts the
  product's words in the field for her to finish.

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
