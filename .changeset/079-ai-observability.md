---
'@kete-africa/ai': minor
---

Observing models (spec 058): `observeModels` traces every AI SDK call through its OpenTelemetry
integration, to Langfuse when configured, without what people wrote unless allowed; each call's cost
is recorded from `KETE_AI_PRICES` (`aiCostMigrationSql`), and `store.report` sums usage and cost by
purpose, model and actor.
