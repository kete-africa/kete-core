# Spec 058 — Observing models: traces and costs

## Why

« What does the assistant cost us this month, and for what? » A product that calls models must know
each call — its model, tokens, duration, purpose, who asked — and what it cost, before billing a
client or tuning a prompt. Built on what exists: the AI SDK's OpenTelemetry integration
(`@ai-sdk/otel`, GenAI semantic conventions), Langfuse's span processor (`@langfuse/otel`) as an
optional destination, and the usage journal `@kete/ai` already keeps in the product's Postgres.

```mermaid
sequenceDiagram
  participant P as Product
  participant A as @kete/ai
  participant M as Model (AI SDK)
  participant DB as Postgres (kete_ai_usage)
  participant L as Langfuse (optional)
  P->>A: observeModels() at startup
  P->>A: ask / askStream / extract (metering: purpose, actor)
  A->>DB: budget checked
  A->>M: the call, traced (functionId = purpose; content only if allowed)
  M-->>L: spans (model, tokens, duration)
  A->>DB: usage + cost_micro_usd (KETE_AI_PRICES)
  P->>A: store.report(organization, period)
  A-->>P: by purpose, model, actor: calls, tokens, cost
```

## Requirements

- **FR-001**: `observeModels` registers the AI SDK's OpenTelemetry integration once, towards
  Langfuse when `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are set, or towards the span
  processors given; disabled otherwise.
- **FR-002**: calls through `ask`, `askStream`, `extract` carry their purpose as `functionId`;
  prompts and answers are traced only with `KETE_AI_TRACE_CONTENT=true`.
- **FR-003**: `modelPricesFromEnv` reads `KETE_AI_PRICES`; `costOf` gives a call's cost in
  millionths of a dollar, null without a price.
- **FR-004**: `aiCostMigrationSql` adds `cost_micro_usd` (idempotent); `postgresBudgetStore(pool,
  { prices })` records each call's cost; `report(organization, period)` sums calls, tokens and cost
  by purpose, model and actor, under RLS.
- **FR-005**: no service of ours; no vendor name in a domain layer.

## Next

Evaluations of prompts and skills in Langfuse (datasets); agents' traces (spec 057).
