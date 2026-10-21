# @kete-africa/agents

## 0.5.1

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.5.0

### Minor Changes

- 877b463: Security review fixes (spec 134): `publicFetch` checks the address again when connecting (no DNS rebinding) and cuts a long body; once outside content is in a turn, the agent's computer waits for a person and `web_read` reads only an address that content gave (`outsideTurn`, `UNSEEN_ADDRESS`).

## 0.4.0

### Minor Changes

- a0b89db: Agents with abilities beyond the product (spec 129): `@kete/ai` says an answer aloud (`speech`, `speechModel`: OpenAI or Mistral's Voxtral) and searches the web with the model provider's own search (`webSearch`, `searchingModel`); `@kete/agents` gives an agent `web_search`, `web_read`, a computer of its own (`computerTools` on `@kete/sandbox`) and sub-agents (`AgentTurn.subAgents`), each bringing outside content, and `guardOutside` applies the outside-content rule to any loop; `@kete/settings` adds `kete.agent_abilities` (off by default) and `kete.spoken_answers`; `@kete/tools` shares the public-internet guard (`publicFetch`, `reachable`, `isPublicIp`).

## 0.3.1

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.3.0

### Minor Changes

- Kete Intelligence (spec 101): `@kete-africa/intelligence` streams a turn of the agents' runtime as the contract `intelligence-event.v1` and draws it in the drawer beside the page — status, plan, each capability with its level, the words as they come, drafts, sources, « Arrêter ». `@kete-africa/agents` says each capability as it starts (`calling`). The contract accepts a product's own addresses for a draft and a source. The template's page « Demander » becomes the drawer.

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
