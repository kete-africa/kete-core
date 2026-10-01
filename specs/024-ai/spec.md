# Feature Specification: The model port

**Feature Branch**: `024-ai`
**Created**: 2026-09-30
**Status**: Implemented
**Input**: Doctrine D-029 (the model is configuration; DeepSeek first, the provider chosen by the
data's sensitivity), D-030 (`@kete/ai`), PRINCIPES (an agent has a budget). Firmo already calls a
model through its own port; Kete Enterprise's chat needs the same, with capabilities as tools.

## User Scenarios & Testing

### User Story 1 — One port, any provider (P1)

1. **Given** a configuration (provider, model, key, base URL), **Then** a model of DeepSeek, OpenAI,
   Anthropic, Mistral or any OpenAI-compatible host is built; nothing in a product names a provider.
2. **Given** the environment (`KETE_AI_PROVIDER`, `KETE_AI_MODEL`, `KETE_AI_API_KEY`,
   `KETE_AI_BASE_URL`), **Then** the configuration is read from it.

### User Story 2 — Capabilities as tools (P1)

1. **Given** the caller's capabilities, **When** the model calls one as a tool, **Then** it goes
   through the capability registry, and the model answers with its result.
2. **Given** a chat screen, **Then** the same turn streams (`askStream`).

### User Story 3 — Usage and budgets (P1)

1. **Given** a metered call, **Then** its tokens are recorded for its organization and, when an
   agent calls, for that agent.
2. **Given** a spent monthly budget of the organization or of the agent, **Then** the call is
   refused before the model is called; people are not limited by an agent's budget.
3. **Given** two organizations, **Then** neither sees the other's usage.

### User Story 4 — Structured reading (P2)

1. **Given** a Zod schema, **Then** `extract` returns a value of it, metered — typically a record
   prepared as a draft.

## Requirements

- **FR-001**: `@kete/ai` on the Vercel AI SDK 7: `languageModel`, `embeddingModel`,
  `transcriptionModel`, `modelConfigFromEnv`.
- **FR-002**: `ask`, `askStream`, `extract`, `toolsFrom`.
- **FR-003**: `aiMigrationSql` (usage append-only for the application role; monthly budgets) and
  `postgresBudgetStore`.
- **FR-004**: A live test with a real model runs only when `KETE_AI_TEST_*` is set.

## Success Criteria

- **SC-001**: The 8 tests of `ai` pass with the AI SDK's mock models and the Neon `test` branch.
- **SC-002**: With `KETE_AI_TEST_*` set to DeepSeek, the live test calls a capability as a tool.
