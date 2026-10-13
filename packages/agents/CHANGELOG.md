# @kete-africa/agents

## 0.1.0

### Minor Changes

- A new package (spec 089, decision 0010): a turn of an agent on Mastra behind a thin layer —
  `runAgent` and `streamAgent` with the caller’s capabilities as the only tools, usage measured and
  budgets enforced, four events for a page — and the agent’s conversations kept in the runtime’s
  tables under each organization’s row-level security (`agentConversationsMigrationSql`,
  `agentConversations`, `organizationPool`).
