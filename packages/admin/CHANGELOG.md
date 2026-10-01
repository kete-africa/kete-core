# @kete-africa/admin

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
