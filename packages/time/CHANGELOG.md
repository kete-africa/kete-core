# @kete-africa/time

## 0.4.2

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.4.1

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.4.0

### Minor Changes

- d8913af: Threads people live in (spec 139): `message.v1` says `visibility` and `moved_from`, `holding.v1` a `priority`, `snoozed_until` and a holding waited on; `@kete/threads` gives unread counts and marks, members and mentions, files with versions, moved messages and live changes (`threadsLiveMigrationSql`, `threadSummariesOf`, `listenThreads`, `changesSince`); `@kete/channels` answers on WhatsApp in its 24-hour window or by template (`answerByChat`); `@kete/work` priorities, snoozes and nudges by priority (`workPrioritiesMigrationSql`); `@kete/time` her days as an iCalendar feed (`icsFeed`); `@kete/drafts` a draft anyone can read (`describeDraft`); `@kete/policies` the six policies as templates and their simulation; `@kete/center` an app object's thread (`openObjectThread`); settings for nudges, the threads' digest and WhatsApp's template.

## 0.3.2

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.3.1

### Patch Changes

- Published on `@kete/sdk` with the deployment events (spec 123), so an app upgrading the SDK keeps
  one copy of it.

## 0.3.0

### Minor Changes

- 4a178d7: The organization's calendar (spec 118): `calendarFrom` reads the working days, hours and holidays
  from Kete's settings; `isWorkingDay`, `holidayOn`, `workingDaysBetween` and `addWorkingDays`
  compute with them; `workdayOf` hands the same calendar to the planner.

## 0.2.4

### Patch Changes

- Republished on sdk 0.14 and work 0.2 (spec 114).

## 0.2.3

### Patch Changes

- Published against the sdk of this release, so that a product meets one copy of the contracts.

## 0.2.2

### Patch Changes

- Published against the sdk of this release, so that a product meets one copy of the contracts.

## 0.2.1

### Patch Changes

- Built against `@kete-africa/sdk` 0.11.0: a product reading dated facts with the sdk 0.11 (for
  `holding.v1`) and passing them to `@kete-africa/time` now meets one `DatedFact` type, not two.

## 0.2.0

### Minor Changes

- The lifecycle (spec 105, step L7). `@kete-africa/lifecycle` keeps skills, agents and apps with
  their owner, version, tier and test cases, and the lessons their use taught — gathered with
  consent, kept as test cases or dropped by their owner — promoted one tier at a time with a review by
  their risk (`/server`); and, pure, an agent's six states, budget, triggers and autonomy earned by
  proofs. `@kete-africa/time` now holds routines (`nextRun`), which `@kete-africa/boards` re-exports.
  `@kete-africa/design` adds `AgentCard`, `LessonCard` and `TierLadder`.

## 0.1.0

### Minor Changes

- The time of the organization (spec 102, step L4). `@kete-africa/time` computes when dated facts
  happen (`occurrences`, `placeInDays`), what clashes (`conflicts`: expected while away, two places
  at once), a person's free time (`freeSlots`) and blocks for her tasks before their day
  (`proposeBlocks`, on the half hour); `icsAgenda` reads her own agenda as « busy » facts.
  `@kete-africa/center` says an app's dated facts (`sendDatedFact`, `dropDatedFact`).
  `@kete-africa/design` draws them: `WeekCalendar`, `AgendaList`, `TeamLanes`.
