# @kete-africa/create-app

## 0.11.1

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.11.0

### Minor Changes

- 72aee61: Settings in layers (spec 115): `@kete/settings` 0.1.0 — declared once, resolved from Kete's default
  through the organization, the app, the entity and the person to the device, journaled; the frame
  says a theme choice (`onTheme`) so the product saves it as her preference; a new app reads its
  settings through the module and its theme and language follow the person.
- 5c5c341: Settings where a command runs (spec 117): the Compte Kete's client keeps an organization's layer by
  its id (`organization(id)`, five minutes) and `settingsHere` resolves inside the organization's
  transaction — the app's layer over the organization's, never a person's; a new app's commands read
  theirs with `settingsIn(db, organizationId)`.
- f251c61: « Réglages » (spec 116): `@kete/shell` draws the same settings page in every app from the
  declarations (`SettingsPanel`, `controlOf`, `sayValue`) — her preferences first, then the
  organization's, each value with where it comes from; a declaration says the words of its choices
  (`choices`); a new app has « Réglages » at the foot of its places, her preferences saved in the
  Compte Kete and the app's settings journaled under `settings:manage`.

## 0.10.0

### Minor Changes

- b1ab69b: The apps on the living model (spec 114): `holding.v1` carries where a holding opens; `@kete/work`
  keeps a source in step (`syncSource`) and stores the link (`workLinksMigrationSql`); `@kete/center`
  says an app's holdings (`sayHoldings`) and passes its gestures through the organization's policies
  (`checkGesture`); a new app says its holdings after each gesture and every minute.

## 0.9.1

### Patch Changes

- The app template moves to TanStack Start 1.169 (the fix for GHSA-qx66-fv34-fjm8, a reflected XSS in
  TanStack Start's server) and to Vite 8 with `@vitejs/plugin-react` 6, which that version needs.

## 0.9.0

### Minor Changes

- The frame and Kete Intelligence of the validated canvas v3.1 (spec 108): `CanvasFrame` and its
  `Frame*` parts, `CanvasIcon`, `FramePage` and `FramePageHead`, the canvas's `VerificationCard`, `KpiTile`
  and `ghost` button in `@kete/design`; `AppFrame` on them, with the app's head, what waits in each
  place, the apps at the bottom and the page « Demander » on a phone; the drawer's head, context, scope,
  plan, capabilities with what they were called with, drafts as their card, « Régénérer » and tally.
  The template wears them.

## 0.8.0

### Minor Changes

- Proposals and voice (spec 104, step L6). `@kete-africa/drafts` keeps proposal sets — applied
  together by one gesture, a level 4 item waiting for its own confirmation, undone together
  (`proposeSet`, `applySet`, `dismissSet`, `undoSet`, `proposalSetsMigrationSql`). `@kete-africa/ai`
  understands a note as gestures on the objects the app knows (`understand`), never guessed.
  `@kete-africa/notify` gives a message's words, a voice note written by the dictation port
  (`wordsOf`). `@kete-africa/sdk`: a proposal's item carries its capability's `input` (additive).
  `@kete-africa/design` adds `ProposalList` and `VoiceCapture`. A generated app closes its day at
  `/soir`.

## 0.7.0

### Minor Changes

- Figures and boards (spec 103, step L5). `@kete-africa/sdk` adds the contract `metric-reading.v1`
  (`validateMetricReading`). `@kete-africa/metrics` computes an app's declared figures within the
  reader's rights, over a period compared with the one before, serves them at `/api/metrics` and
  reads another app's (`/server`); screens get periods and `trend`. `@kete-africa/boards` keeps a
  board's cards in places, runs its routine, freezes it as a summary, says what changed and makes it a
  document to index by choice. `@kete-africa/design` adds `KpiTile`'s `trend`, `BoardGrid` and
  `SummaryCard`. A generated app declares `tasks.open` and `tasks.overdue` and serves `/api/metrics`.

## 0.6.0

### Minor Changes

- Kete Intelligence (spec 101): `@kete-africa/intelligence` streams a turn of the agents' runtime as the contract `intelligence-event.v1` and draws it in the drawer beside the page — status, plan, each capability with its level, the words as they come, drafts, sources, « Arrêter ». `@kete-africa/agents` says each capability as it starts (`calling`). The contract accepts a product's own addresses for a draft and a source. The template's page « Demander » becomes the drawer.

## 0.5.0

### Minor Changes

- The shell (spec 100): `@kete-africa/shell` draws the frame every Kete product wears from the app's manifest — places, Ctrl K, « Demander » beside the page, « Noter », the state of synchronization, the phone's tabs. `@kete-africa/design` gains `DecisionCard`, `Mention`, `AgentRunState` and « Pourquoi ? » under a `KpiTile`; Ctrl K always offers to ask the words typed. The template wears the shell.

## 0.4.0

### Minor Changes

- A new app is born with intake: a message or a photo read into a draft whose every field says
  where it comes from, shown on the verification card (spec 098).

## 0.3.1

### Patch Changes

- A new app is born with `@kete/center` 0.5 (a decision with its project, and sent back), and the
  README says how to get today's template on the day it changes.

## 0.3.0

### Minor Changes

- The template, born complete (spec 093): business roles (`businessRoles`, `businessRoleOf`,
  `businessRolesMigrationSql`) and `performGesture` with `RuleError` in `@kete/capabilities`; form
  fields (`SelectField`, `CheckField`, `ChoiceField`, `TextAreaField`, `ErrorNote`, `InfoNote`) in
  `@kete/design`; `signSession` in `@kete/auth`; and a new app born with « Demander », WhatsApp and
  Telegram, usage, logs and the roles of its trade.

## 0.2.6

### Patch Changes

- 990b4fb: The template tests with Vitest 4 (two critical advisories on the worker pool of Vitest 3), and
  leaves compiled copies of the tests out of a run.

## 0.2.5

### Patch Changes

- A generated app's test is named after the app everywhere: the address it asks the center no longer
  keeps the template's product (`kete-core#84`), so the first run passes its 14 tests.

## 0.2.4

### Patch Changes

- bead1c9: The app contract, part 2 (spec 049): an app's own token for its center (`createAppToken`,
  `createAppTokenVerifier`, scope `kete:center`); named outboxes and a token transport, so business
  events reach the center without a shared key; the directory in `@kete/center`; the template
  announces `task.created` and `task.completed`.
- ad3a75c: The app contract, part 3 (spec 049): an agent's mandate. The Compte Kete exchanges a person's
  token for one an agent of the center carries (`POST /api/apps/mandates`, scope `kete:mandate`);
  `@kete/auth` reads `actingAgent` and gives the center `createMandates`; the template makes the
  caller the agent, for the person.

## 0.2.3

### Patch Changes

- aa87c98: The app contract (spec 049): an app declares its permissions with their words and default roles,
  the classification of its capabilities and data sets, the events it emits, the subjects it asks
  decisions for and its client id. `@kete/center` reads a person's grants at Kete Enterprise;
  `createRights` follows them once the organization manages the app's rights.

## 0.2.2

### Patch Changes

- 7df2401: Forms in their place and every mode (spec 044): `Drawer` opens on the right when the screen is
  wide and centered otherwise; `FormPage` and `FormSection` give a long form its own page;
  `ThemeChoice` and `themeFromCookies`, `themeCookie`, `applyTheme` let a person choose dark, light
  or automatic, rendered by the server. A new app's template offers the choice and trusts Kete's own
  packages as soon as they are published.
- 77cfb71: The integration contract (spec 045): `dataset.v1` and the manifest's `datasets` and `endpoints`;
  `defineDataset`, `createDatasetRegistry` and `createHttpApi` serve an app's capabilities and data
  sets over HTTP under the caller's rights; `exposeRecord` turns a record type into `{type}_list` and
  `{type}_get`. A new app's template exposes its tasks, mounts its API at `/api/v1` and declares
  everything in its manifest.

## 0.2.1

### Patch Changes

- 79993e1: The page slots of an enterprise app (spec 040): `PageHeader`, `Tabs`, `CommandBar`,
  `ViewSwitcher`, `DataTable`, `Drawer`, `SplitView`, `DetailPane`, `Facts`, `KpiTile`, `KpiGrid`,
  `RowList`, `OrgChart`, and a chat kit to the usual standards (`ChatThread`, `ChatMessage`,
  `ToolCard`, `Composer`, `Suggestions`, `CopyButton`, a safe `Markdown`). A new app's template now
  serves its stylesheet from a container: `--static ../client`, and Tailwind never scans `dist/`.

## 0.2.0

### Minor Changes

- 09f35ee: `manifest.v1` carries an app's identity card (doctrine D-040), optional and additive: `governance`
  with its owner, data categories, use of AI and criticality. `createApp` and
  `pnpm create @kete-africa/app` now require `--owner`, written into the new app's card.

### Patch Changes

- a875218: A new app reads kete-core's packages the way the Cockpit's move proved: the token never in a
  committed `.npmrc` (user configuration, CI's `KETE_PACKAGES_TOKEN`, the image's build secret), its
  approved build scripts in `pnpm-workspace.yaml`, a `.dockerignore`.

## 0.1.0

### Minor Changes

- 56aadff: The template of a Kete App (phase 5, spec 029). New packages: `@kete/jobs` (background jobs on
  Postgres with pg-boss: queued e-mails, the event relay), `@kete/admin` (Kete operators, operator
  gestures as journaled commands, the audit and its screen), `@kete/feedback` (the feedback button and
  its RLS table), `@kete/create-app` (`pnpm create @kete-africa/app`). `@kete/design/generate` lets an
  app generate its own design (D-038) with the same contrast checks. `@kete/testing`'s global setup
  starts one container even when declared twice.
