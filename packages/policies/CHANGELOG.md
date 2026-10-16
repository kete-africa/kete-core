# @kete-africa/policies

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
