# @kete-africa/threads

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
