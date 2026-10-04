# @kete-africa/ai

## 0.2.0

### Minor Changes

- 016bcb3: `readDocument` reads Excel (sheet by sheet), PowerPoint (slide by slide), OpenDocument and RTF
  through officeparser, and gives scans (an image, a PDF without text) to a `transcribe` port.
  `@kete/ai`'s `scanReader(model)` is that port: a multimodal model reads the scan page by page,
  metered.
- d7c253c: New package `@kete/skills`: Agent Skills read and validated by the standard, kept in Postgres with
  their versions and audience, offered to a model progressively (`skillsCatalog`, `skillTools`),
  checked against their own `evals/evals.json`. `@kete/ai` adds `hostedShell`: the provider's sandbox,
  network off, where skills' scripts run.
- 7787dab: Observing models (spec 058): `observeModels` traces every AI SDK call through its OpenTelemetry
  integration, to Langfuse when configured, without what people wrote unless allowed; each call's cost
  is recorded from `KETE_AI_PRICES` (`aiCostMigrationSql`), and `store.report` sums usage and cost by
  purpose, model and actor.

## 0.1.1

### Patch Changes

- Follows the new versions of `@kete-africa/commands` and `@kete-africa/sdk`: a package pins the
  exact versions of its `@kete-africa` dependencies when it is published, so an app never gets two
  copies of the command journal.

## 0.1.0

### Minor Changes

- fe53b54: First release: one model port for DeepSeek, OpenAI, Anthropic, Mistral and any OpenAI-compatible
  host; capabilities as tools; `ask`, `askStream` and `extract`, metered against monthly token budgets
  per organization and per agent.
