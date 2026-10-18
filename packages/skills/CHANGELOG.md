# @kete-africa/skills

## 0.1.1

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.1.0

### Minor Changes

- d7c253c: New package `@kete/skills`: Agent Skills read and validated by the standard, kept in Postgres with
  their versions and audience, offered to a model progressively (`skillsCatalog`, `skillTools`),
  checked against their own `evals/evals.json`. `@kete/ai` adds `hostedShell`: the provider's sandbox,
  network off, where skills' scripts run.
