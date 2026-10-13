# @kete-africa/agents

## 0.2.0

### Minor Changes

- Memory with its governance (spec 090): consent, retention, forgetting and erasure, a journal of
  gestures without words (`agentMemoryMigrationSql`, `remember`, `memoriesFor`, `eraseMemories`,
  `rememberTool`), all conversations erased at once (`eraseAll`); the rule that a turn which read
  outside content runs nothing that acts at once (`outside`); evaluations checked by code
  (`evaluateAgent`); and in `@kete/ai` the dictation port (`dictation`), with Mistral's Voxtral as a
  transcription model.

## 0.1.0

### Minor Changes

- A new package (spec 089, decision 0010): a turn of an agent on Mastra behind a thin layer —
  `runAgent` and `streamAgent` with the caller’s capabilities as the only tools, usage measured and
  budgets enforced, four events for a page — and the agent’s conversations kept in the runtime’s
  tables under each organization’s row-level security (`agentConversationsMigrationSql`,
  `agentConversations`, `organizationPool`).
