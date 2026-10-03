---
'@kete-africa/sandbox': minor
---

The sandbox provider's own coding agent: `prompt` and `promptStatus` on a sandbox, and `template`
at its creation (the provider's environment that passes the agents' sign-in and nothing else).
The boat adapter also treats `idle` as ready and `error`/`archived` as unavailable. A deletion names its target, as the provider requires.
