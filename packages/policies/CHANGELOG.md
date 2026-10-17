# @kete-africa/policies

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
