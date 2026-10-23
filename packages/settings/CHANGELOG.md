# @kete-africa/settings

## 0.4.5

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.4.4

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.4.3

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.4.2

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.4.1

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.4.0

### Minor Changes

- d8913af: Threads people live in (spec 139): `message.v1` says `visibility` and `moved_from`, `holding.v1` a `priority`, `snoozed_until` and a holding waited on; `@kete/threads` gives unread counts and marks, members and mentions, files with versions, moved messages and live changes (`threadsLiveMigrationSql`, `threadSummariesOf`, `listenThreads`, `changesSince`); `@kete/channels` answers on WhatsApp in its 24-hour window or by template (`answerByChat`); `@kete/work` priorities, snoozes and nudges by priority (`workPrioritiesMigrationSql`); `@kete/time` her days as an iCalendar feed (`icsFeed`); `@kete/drafts` a draft anyone can read (`describeDraft`); `@kete/policies` the six policies as templates and their simulation; `@kete/center` an app object's thread (`openObjectThread`); settings for nudges, the threads' digest and WhatsApp's template.

## 0.3.0

### Minor Changes

- a0b89db: Agents with abilities beyond the product (spec 129): `@kete/ai` says an answer aloud (`speech`, `speechModel`: OpenAI or Mistral's Voxtral) and searches the web with the model provider's own search (`webSearch`, `searchingModel`); `@kete/agents` gives an agent `web_search`, `web_read`, a computer of its own (`computerTools` on `@kete/sandbox`) and sub-agents (`AgentTurn.subAgents`), each bringing outside content, and `guardOutside` applies the outside-content rule to any loop; `@kete/settings` adds `kete.agent_abilities` (off by default) and `kete.spoken_answers`; `@kete/tools` shares the public-internet guard (`publicFetch`, `reachable`, `isPublicIp`).

## 0.2.1

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.2.0

### Minor Changes

- 5c5c341: Settings where a command runs (spec 117): the Compte Kete's client keeps an organization's layer by
  its id (`organization(id)`, five minutes) and `settingsHere` resolves inside the organization's
  transaction — the app's layer over the organization's, never a person's; a new app's commands read
  theirs with `settingsIn(db, organizationId)`.
- f251c61: « Réglages » (spec 116): `@kete/shell` draws the same settings page in every app from the
  declarations (`SettingsPanel`, `controlOf`, `sayValue`) — her preferences first, then the
  organization's, each value with where it comes from; a declaration says the words of its choices
  (`choices`); a new app has « Réglages » at the foot of its places, her preferences saved in the
  Compte Kete and the app's settings journaled under `settings:manage`.

## 0.1.0

### Minor Changes

- Settings in layers (spec 115; decision 0013; doctrine D-060): each setting declared once by its
  owner with its schema, default, layers, permission and words, a secret refused; resolved from
  Kete's default through the organization, the app, the legal entity or unit and the person to the
  device, each value with the layer it comes from; the app's and the entities' layers kept in the
  product (`kete_settings`, with its RLS policy) with an append-only journal; the Compte Kete's two
  layers read with the person's token, kept five minutes per token's hash.
