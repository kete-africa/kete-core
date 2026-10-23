# @kete-africa/ai

## 0.6.7

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.6.6

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.6.5

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.6.4

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.6.3

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.6.2

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.6.1

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.6.0

### Minor Changes

- a0b89db: Agents with abilities beyond the product (spec 129): `@kete/ai` says an answer aloud (`speech`, `speechModel`: OpenAI or Mistral's Voxtral) and searches the web with the model provider's own search (`webSearch`, `searchingModel`); `@kete/agents` gives an agent `web_search`, `web_read`, a computer of its own (`computerTools` on `@kete/sandbox`) and sub-agents (`AgentTurn.subAgents`), each bringing outside content, and `guardOutside` applies the outside-content rule to any loop; `@kete/settings` adds `kete.agent_abilities` (off by default) and `kete.spoken_answers`; `@kete/tools` shares the public-internet guard (`publicFetch`, `reachable`, `isPublicIp`).

## 0.5.1

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.5.0

### Minor Changes

- Proposals and voice (spec 104, step L6). `@kete-africa/drafts` keeps proposal sets — applied
  together by one gesture, a level 4 item waiting for its own confirmation, undone together
  (`proposeSet`, `applySet`, `dismissSet`, `undoSet`, `proposalSetsMigrationSql`). `@kete-africa/ai`
  understands a note as gestures on the objects the app knows (`understand`), never guessed.
  `@kete-africa/notify` gives a message's words, a voice note written by the dictation port
  (`wordsOf`). `@kete-africa/sdk`: a proposal's item carries its capability's `input` (additive).
  `@kete-africa/design` adds `ProposalList` and `VoiceCapture`. A generated app closes its day at
  `/soir`.

## 0.4.0

### Minor Changes

- `intake`: what was received — a message, a photo, a voice note, a document — is read into a
  record's fields, each with its source, its certainty and the passage it was read in; what the
  source does not say is left empty, and the required fields to type are said (spec 098).

## 0.3.0

### Minor Changes

- Memory with its governance (spec 090): consent, retention, forgetting and erasure, a journal of
  gestures without words (`agentMemoryMigrationSql`, `remember`, `memoriesFor`, `eraseMemories`,
  `rememberTool`), all conversations erased at once (`eraseAll`); the rule that a turn which read
  outside content runs nothing that acts at once (`outside`); evaluations checked by code
  (`evaluateAgent`); and in `@kete/ai` the dictation port (`dictation`), with Mistral's Voxtral as a
  transcription model.

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
