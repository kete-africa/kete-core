# @kete-africa/policies

## 0.2.6

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.2.5

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.2.4

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.2.3

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.2.2

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.2.1

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.2.0

### Minor Changes

- d8913af: Threads people live in (spec 139): `message.v1` says `visibility` and `moved_from`, `holding.v1` a `priority`, `snoozed_until` and a holding waited on; `@kete/threads` gives unread counts and marks, members and mentions, files with versions, moved messages and live changes (`threadsLiveMigrationSql`, `threadSummariesOf`, `listenThreads`, `changesSince`); `@kete/channels` answers on WhatsApp in its 24-hour window or by template (`answerByChat`); `@kete/work` priorities, snoozes and nudges by priority (`workPrioritiesMigrationSql`); `@kete/time` her days as an iCalendar feed (`icsFeed`); `@kete/drafts` a draft anyone can read (`describeDraft`); `@kete/policies` the six policies as templates and their simulation; `@kete/center` an app object's thread (`openObjectThread`); settings for nudges, the threads' digest and WhatsApp's template.

## 0.1.5

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.1.4

### Patch Changes

- Published on `@kete/sdk` with the deployment events (spec 123), so an app upgrading the SDK keeps
  one copy of it.

## 0.1.3

### Patch Changes

- Republished on sdk 0.14 and work 0.2 (spec 114).

## 0.1.2

### Patch Changes

- Published against the sdk of this release, so that a product meets one copy of the contracts.

## 0.1.1

### Patch Changes

- A policy set is preparsed once per content of its rules, never per ids and versions: two
  organizations each holding a version 1 of a policy of the same id, with different rules, were
  decided by whichever was read first. An approval policy that fails to evaluate now asks its
  approver instead of being passed over: the engine never fails open.

## 0.1.0

### Minor Changes

- One policy engine at the gesture (spec 112, step P; doctrine D-058). `@kete-africa/policies`
  decides a gesture — the same for a person and her agent — under the organization's policies, on
  Cedar run in the process: authority (a forbid refuses, never fail open), approval (a permit asks
  its approver), trial (observed, never enforced); policies versioned, decisions journaled with
  their policies and versions (`createPolicyEngine`, `savePolicy`, `decideGesture`, `readDecisions`,
  `authorizeWith`, `unmet`). `@kete-africa/commands`: `executeCommand` asks `authorize` before it
  runs and stops with `refused_by_policy` or `approval_required`. `@kete-africa/sdk` adds
  `gesture.v1`, `policy.v1` and `policy-decision.v1`.
