# @kete-africa/design

## 0.15.0

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

## 0.14.1

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.14.0

### Minor Changes

- The frame and Kete Intelligence of the validated canvas v3.1 (spec 108): `CanvasFrame` and its
  `Frame*` parts, `CanvasIcon`, `FramePage` and `FramePageHead`, the canvas's `VerificationCard`, `KpiTile`
  and `ghost` button in `@kete/design`; `AppFrame` on them, with the app's head, what waits in each
  place, the apps at the bottom and the page « Demander » on a phone; the drawer's head, context, scope,
  plan, capabilities with what they were called with, drafts as their card, « Régénérer » and tally.
  The template wears them.

## 0.13.0

### Minor Changes

- The phone (spec 106, step L8). `@kete-africa/shell` adds the morning's pile (`MorningPile`), the
  field mode « Terrain » (`FieldFrame`) and `useSunlight`. `@kete-africa/design` generates « Plein
  soleil » for every design — `data-sun="on"`, the light mode at its strongest, its contrasts checked.

## 0.12.0

### Minor Changes

- The lifecycle (spec 105, step L7). `@kete-africa/lifecycle` keeps skills, agents and apps with
  their owner, version, tier and test cases, and the lessons their use taught — gathered with
  consent, kept as test cases or dropped by their owner — promoted one tier at a time with a review by
  their risk (`/server`); and, pure, an agent's six states, budget, triggers and autonomy earned by
  proofs. `@kete-africa/time` now holds routines (`nextRun`), which `@kete-africa/boards` re-exports.
  `@kete-africa/design` adds `AgentCard`, `LessonCard` and `TierLadder`.

## 0.11.0

### Minor Changes

- Proposals and voice (spec 104, step L6). `@kete-africa/drafts` keeps proposal sets — applied
  together by one gesture, a level 4 item waiting for its own confirmation, undone together
  (`proposeSet`, `applySet`, `dismissSet`, `undoSet`, `proposalSetsMigrationSql`). `@kete-africa/ai`
  understands a note as gestures on the objects the app knows (`understand`), never guessed.
  `@kete-africa/notify` gives a message's words, a voice note written by the dictation port
  (`wordsOf`). `@kete-africa/sdk`: a proposal's item carries its capability's `input` (additive).
  `@kete-africa/design` adds `ProposalList` and `VoiceCapture`. A generated app closes its day at
  `/soir`.

## 0.10.0

### Minor Changes

- Figures and boards (spec 103, step L5). `@kete-africa/sdk` adds the contract `metric-reading.v1`
  (`validateMetricReading`). `@kete-africa/metrics` computes an app's declared figures within the
  reader's rights, over a period compared with the one before, serves them at `/api/metrics` and
  reads another app's (`/server`); screens get periods and `trend`. `@kete-africa/boards` keeps a
  board's cards in places, runs its routine, freezes it as a summary, says what changed and makes it a
  document to index by choice. `@kete-africa/design` adds `KpiTile`'s `trend`, `BoardGrid` and
  `SummaryCard`. A generated app declares `tasks.open` and `tasks.overdue` and serves `/api/metrics`.

## 0.9.0

### Minor Changes

- The time of the organization (spec 102, step L4). `@kete-africa/time` computes when dated facts
  happen (`occurrences`, `placeInDays`), what clashes (`conflicts`: expected while away, two places
  at once), a person's free time (`freeSlots`) and blocks for her tasks before their day
  (`proposeBlocks`, on the half hour); `icsAgenda` reads her own agenda as « busy » facts.
  `@kete-africa/center` says an app's dated facts (`sendDatedFact`, `dropDatedFact`).
  `@kete-africa/design` draws them: `WeekCalendar`, `AgendaList`, `TeamLanes`.

## 0.8.0

### Minor Changes

- The shell (spec 100): `@kete-africa/shell` draws the frame every Kete product wears from the app's manifest — places, Ctrl K, « Demander » beside the page, « Noter », the state of synchronization, the phone's tabs. `@kete-africa/design` gains `DecisionCard`, `Mention`, `AgentRunState` and « Pourquoi ? » under a `KpiTile`; Ctrl K always offers to ask the words typed. The template wears the shell.

## 0.7.0

### Minor Changes

- The template, born complete (spec 093): business roles (`businessRoles`, `businessRoleOf`,
  `businessRolesMigrationSql`) and `performGesture` with `RuleError` in `@kete/capabilities`; form
  fields (`SelectField`, `CheckField`, `ChoiceField`, `TextAreaField`, `ErrorNote`, `InfoNote`) in
  `@kete/design`; `signSession` in `@kete/auth`; and a new app born with « Demander », WhatsApp and
  Telegram, usage, logs and the roles of its trade.

## 0.6.0

### Minor Changes

- The shell of Kete 2026: a command palette (Ctrl K) on cmdk — search, ask and act from one field —
  with its trigger in the toolbar; a phone's bar of tabs with a raised « ask » action; counts of
  what waits beside the sidebar's items; links to another app marked and opened in a new tab; new
  icons (home, sparkle, people, folder, layers, flag, external, menu, clock).

## 0.5.0

### Minor Changes

- 203aa3a: Icons for the chat (spec 027): `attach`, `mic`, `file`.

## 0.4.0

### Minor Changes

- 7df2401: Forms in their place and every mode (spec 044): `Drawer` opens on the right when the screen is
  wide and centered otherwise; `FormPage` and `FormSection` give a long form its own page;
  `ThemeChoice` and `themeFromCookies`, `themeCookie`, `applyTheme` let a person choose dark, light
  or automatic, rendered by the server. A new app's template offers the choice and trusts Kete's own
  packages as soon as they are published.

## 0.3.0

### Minor Changes

- 79993e1: The page slots of an enterprise app (spec 040): `PageHeader`, `Tabs`, `CommandBar`,
  `ViewSwitcher`, `DataTable`, `Drawer`, `SplitView`, `DetailPane`, `Facts`, `KpiTile`, `KpiGrid`,
  `RowList`, `OrgChart`, and a chat kit to the usual standards (`ChatThread`, `ChatMessage`,
  `ToolCard`, `Composer`, `Suggestions`, `CopyButton`, a safe `Markdown`). A new app's template now
  serves its stylesheet from a container: `--static ../client`, and Tailwind never scans `dist/`.

## 0.2.0

### Minor Changes

- 56aadff: The template of a Kete App (phase 5, spec 029). New packages: `@kete/jobs` (background jobs on
  Postgres with pg-boss: queued e-mails, the event relay), `@kete/admin` (Kete operators, operator
  gestures as journaled commands, the audit and its screen), `@kete/feedback` (the feedback button and
  its RLS table), `@kete/create-app` (`pnpm create @kete-africa/app`). `@kete/design/generate` lets an
  app generate its own design (D-038) with the same contrast checks. `@kete/testing`'s global setup
  starts one container even when declared twice.
- 2599b6c: Two designs in three layers (doctrine D-035): `kete` and `workspace` (the copilot-demo workspace's
  system, dark first), each with its DESIGN.md (base tokens, also as W3C Design Tokens), semantic tokens for both modes with their contrasts checked,
  components that use semantic tokens only — the doctrine's (verification card, agent states,
  confirmation, notification with undo, empty page) and the workspace's (frame, page, app grid,
  filters, menus, search, dialog) — and client brands,
  refused when their contrasts fail. `DESIGN.md` moves to `designs/kete/DESIGN.md` (the
  `@kete/design/DESIGN.md` export still points to it).
- dc09e1d: Views in copilots (MCP Apps, doctrine D-037). `capability.v1` names a capability's view; the MCP
  handler serves views as `ui://` resources, names each tool's view, and lets the person decide a
  draft in the view (`kete_draft_review`, `kete_draft_validate`, `kete_draft_refuse`, visible to the
  view only), level 4 staying in the product's screen; `registry.review` and `registry.decide`;
  protected resource metadata (RFC 9728). New package `@kete/views`: the generic views (draft review,
  form, table, detail) as one self-contained page. A new actor channel, `view`. `@kete/design`
  exports `base.css`, its styles without font files.
