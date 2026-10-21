# @kete-africa/center

## 0.8.0

### Minor Changes

- d8913af: Threads people live in (spec 139): `message.v1` says `visibility` and `moved_from`, `holding.v1` a `priority`, `snoozed_until` and a holding waited on; `@kete/threads` gives unread counts and marks, members and mentions, files with versions, moved messages and live changes (`threadsLiveMigrationSql`, `threadSummariesOf`, `listenThreads`, `changesSince`); `@kete/channels` answers on WhatsApp in its 24-hour window or by template (`answerByChat`); `@kete/work` priorities, snoozes and nudges by priority (`workPrioritiesMigrationSql`); `@kete/time` her days as an iCalendar feed (`icsFeed`); `@kete/drafts` a draft anyone can read (`describeDraft`); `@kete/policies` the six policies as templates and their simulation; `@kete/center` an app object's thread (`openObjectThread`); settings for nudges, the threads' digest and WhatsApp's template.

## 0.7.2

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.7.1

### Patch Changes

- Published on `@kete/sdk` with the deployment events (spec 123), so an app upgrading the SDK keeps
  one copy of it.

## 0.7.0

### Minor Changes

- b1ab69b: The apps on the living model (spec 114): `holding.v1` carries where a holding opens; `@kete/work`
  keeps a source in step (`syncSource`) and stores the link (`workLinksMigrationSql`); `@kete/center`
  says an app's holdings (`sayHoldings`) and passes its gestures through the organization's policies
  (`checkGesture`); a new app says its holdings after each gesture and every minute.

## 0.6.0

### Minor Changes

- The time of the organization (spec 102, step L4). `@kete-africa/time` computes when dated facts
  happen (`occurrences`, `placeInDays`), what clashes (`conflicts`: expected while away, two places
  at once), a person's free time (`freeSlots`) and blocks for her tasks before their day
  (`proposeBlocks`, on the half hour); `icsAgenda` reads her own agenda as « busy » facts.
  `@kete-africa/center` says an app's dated facts (`sendDatedFact`, `dropDatedFact`).
  `@kete-africa/design` draws them: `WeekCalendar`, `AgendaList`, `TeamLanes`.

## 0.5.0

### Minor Changes

- A decision an app asks carries its project (`projectId`: a step of the circuit may be its lead's)
  and may come back `returned` — sent back to who asked, with the reason; asked again under the same
  reference, it is the same request, corrected (Kete Enterprise spec 075).

## 0.4.0

### Minor Changes

- The center's references and the facts of money: `@kete/center` reads third parties and projects
  with the person's token, opens a project from the app's own document, and says a fact of money in
  the shape of the new contract `money-fact.v1`, which `@kete/sdk` validates (`validateMoneyFact`).

## 0.3.0

### Minor Changes

- bead1c9: The app contract, part 2 (spec 049): an app's own token for its center (`createAppToken`,
  `createAppTokenVerifier`, scope `kete:center`); named outboxes and a token transport, so business
  events reach the center without a shared key; the directory in `@kete/center`; the template
  announces `task.created` and `task.completed`.
- fe88e80: The app contract, part 4 (spec 049): `requestDecision` asks the center's circuits for the person;
  `decision` reads the outcome with the app's own token.

## 0.2.0

### Minor Changes

- aa87c98: The app contract (spec 049): an app declares its permissions with their words and default roles,
  the classification of its capabilities and data sets, the events it emits, the subjects it asks
  decisions for and its client id. `@kete/center` reads a person's grants at Kete Enterprise;
  `createRights` follows them once the organization manages the app's rights.
