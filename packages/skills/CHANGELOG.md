# @kete-africa/skills

## 0.1.0

### Minor Changes

- d7c253c: New package `@kete/skills`: Agent Skills read and validated by the standard, kept in Postgres with
  their versions and audience, offered to a model progressively (`skillsCatalog`, `skillTools`),
  checked against their own `evals/evals.json`. `@kete/ai` adds `hostedShell`: the provider's sandbox,
  network off, where skills' scripts run.
