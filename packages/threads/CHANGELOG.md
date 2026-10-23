# @kete-africa/threads

## 0.3.5

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.3.4

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.3.3

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.3.2

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.3.1

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.3.0

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

## 0.2.0

### Minor Changes

- d8913af: Threads people live in (spec 139): `message.v1` says `visibility` and `moved_from`, `holding.v1` a `priority`, `snoozed_until` and a holding waited on; `@kete/threads` gives unread counts and marks, members and mentions, files with versions, moved messages and live changes (`threadsLiveMigrationSql`, `threadSummariesOf`, `listenThreads`, `changesSince`); `@kete/channels` answers on WhatsApp in its 24-hour window or by template (`answerByChat`); `@kete/work` priorities, snoozes and nudges by priority (`workPrioritiesMigrationSql`); `@kete/time` her days as an iCalendar feed (`icsFeed`); `@kete/drafts` a draft anyone can read (`describeDraft`); `@kete/policies` the six policies as templates and their simulation; `@kete/center` an app object's thread (`openObjectThread`); settings for nudges, the threads' digest and WhatsApp's template.

## 0.1.3

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.1.2

### Patch Changes

- Published on `@kete/sdk` with the deployment events (spec 123), so an app upgrading the SDK keeps
  one copy of it.

## 0.1.1

### Patch Changes

- Republished on sdk 0.14 and work 0.2 (spec 114).

## 0.1.0

### Minor Changes

- Threads (spec 113, step M; doctrine D-057): threads born with their object, groups, direct
  threads and each person's thread with Kete, always with a holder; members since when; messages
  never rewritten (an edit is a new version), « read by » with its date, « for action » as a
  holding; full-text search; a thread exported with its journal and its SHA-256 fingerprint.
