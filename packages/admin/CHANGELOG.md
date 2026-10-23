# @kete-africa/admin

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

- 9c1f2e7: Operators without a second factor on staging only (spec 135): `secondFactorWaived()`, `KETE_OPERATORS_SECOND_FACTOR=optional`, never in production.

## 0.2.2

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.2.1

### Patch Changes

- Follows `@kete-africa/auth` 0.2.0: a published package pins its `@kete-africa` dependencies exactly.

## 0.2.0

### Minor Changes

- 90743a9: `AuditLog` shows the agents that asked for a gesture ("at the request of …", doctrine D-039) when
  given the optional `delegatedBy` label.

## 0.1.0

### Minor Changes

- 56aadff: The template of a Kete App (phase 5, spec 029). New packages: `@kete/jobs` (background jobs on
  Postgres with pg-boss: queued e-mails, the event relay), `@kete/admin` (Kete operators, operator
  gestures as journaled commands, the audit and its screen), `@kete/feedback` (the feedback button and
  its RLS table), `@kete/create-app` (`pnpm create @kete-africa/app`). `@kete/design/generate` lets an
  app generate its own design (D-038) with the same contrast checks. `@kete/testing`'s global setup
  starts one container even when declared twice.
