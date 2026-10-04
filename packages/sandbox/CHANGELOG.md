# @kete-africa/sandbox

## 0.3.0

### Minor Changes

- 31fe2a0: `open(id)` resumes a stopped sandbox before handing it out, with its files as they were — a
  person's own agent sign-in among them.
  `open(id, { resume: false })` hands it out as it is.

## 0.2.1

### Patch Changes

- bc208bb: A refusal of the provider says why (`provider_not_configured`, `subscription_required`…).

## 0.2.0

### Minor Changes

- cb69481: The sandbox provider's own coding agent: `prompt` and `promptStatus` on a sandbox, and `template`
  at its creation (the provider's environment that passes the agents' sign-in and nothing else).
  The boat adapter also treats `idle` as ready and `error`/`archived` as unavailable. A deletion names its target, as the provider requires.

## 0.1.0

### Minor Changes

- 12b12ce: A new package (spec 047): an isolated computer for agents and the app factory behind a neutral
  port — create, run, write and read files, stop, destroy — with a boat.dev adapter and an in-memory
  provider for tests.
