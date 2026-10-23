# @kete-africa/tools

## 0.2.9

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.2.8

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.2.7

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.2.6

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.2.5

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.2.4

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.2.3

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.2.2

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.2.1

### Patch Changes

- 877b463: Security review fixes (spec 134): `publicFetch` checks the address again when connecting (no DNS rebinding) and cuts a long body; once outside content is in a turn, the agent's computer waits for a person and `web_read` reads only an address that content gave (`outsideTurn`, `UNSEEN_ADDRESS`).

## 0.2.0

### Minor Changes

- a0b89db: Agents with abilities beyond the product (spec 129): `@kete/ai` says an answer aloud (`speech`, `speechModel`: OpenAI or Mistral's Voxtral) and searches the web with the model provider's own search (`webSearch`, `searchingModel`); `@kete/agents` gives an agent `web_search`, `web_read`, a computer of its own (`computerTools` on `@kete/sandbox`) and sub-agents (`AgentTurn.subAgents`), each bringing outside content, and `guardOutside` applies the outside-content rule to any loop; `@kete/settings` adds `kete.agent_abilities` (off by default) and `kete.spoken_answers`; `@kete/tools` shares the public-internet guard (`publicFetch`, `reachable`, `isPublicIp`).

## 0.1.2

### Patch Changes

- 087db6a: Each imported tool's drafts have their own record type (`toolCallDraft(tool)`): a registry holding two
  tools that act no longer refuses them.

## 0.1.1

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.1.0

### Minor Changes

- Imported tools (spec 124; step C4): an OpenAPI 3 description or a remote MCP server read into
  tools — their input as JSON Schema, their effect (read, act, destroy) — called server-side with
  the connection's credential, and turned into capabilities under Kete's autonomy levels: a read
  alone, an act as a draft, a destruction confirmed.
