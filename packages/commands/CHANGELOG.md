# @kete-africa/commands

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

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.3.0

### Minor Changes

- One policy engine at the gesture (spec 112, step P; doctrine D-058). `@kete-africa/policies`
  decides a gesture — the same for a person and her agent — under the organization's policies, on
  Cedar run in the process: authority (a forbid refuses, never fail open), approval (a permit asks
  its approver), trial (observed, never enforced); policies versioned, decisions journaled with
  their policies and versions (`createPolicyEngine`, `savePolicy`, `decideGesture`, `readDecisions`,
  `authorizeWith`, `unmet`). `@kete-africa/commands`: `executeCommand` asks `authorize` before it
  runs and stops with `refused_by_policy` or `approval_required`. `@kete-africa/sdk` adds
  `gesture.v1`, `policy.v1` and `policy-decision.v1`.

## 0.2.0

### Minor Changes

- 45e54f5: The actor of a command can carry its chain of agents (doctrine D-039): `delegatedBy`, the agents
  that asked, and `traceId`. A chain must go back to a person, name each agent once and stay within
  `MAX_DELEGATION_DEPTH`. The journal keeps it and `readJournal` filters by trace. Existing apps add
  `commandsDelegationMigrationSql` to their migrations.

## 0.1.0

### Minor Changes

- 0dce116: First release: named commands with their actor, idempotency key and reversibility, and an
  append-only journal enforced by the database (`commandsMigrationSql`, `readJournal`).
- dc09e1d: Views in copilots (MCP Apps, doctrine D-037). `capability.v1` names a capability's view; the MCP
  handler serves views as `ui://` resources, names each tool's view, and lets the person decide a
  draft in the view (`kete_draft_review`, `kete_draft_validate`, `kete_draft_refuse`, visible to the
  view only), level 4 staying in the product's screen; `registry.review` and `registry.decide`;
  protected resource metadata (RFC 9728). New package `@kete/views`: the generic views (draft review,
  form, table, detail) as one self-contained page. A new actor channel, `view`. `@kete/design`
  exports `base.css`, its styles without font files.
