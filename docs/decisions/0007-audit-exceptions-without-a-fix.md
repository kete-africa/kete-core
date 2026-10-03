---
status: proposed
date: 2026-10-03
decision-makers: the author (Jean-Claude), proposed by the agent; to be accepted by the author
---

# 0007 — Name the advisories without a fix that cannot reach a running service

## Context and Problem Statement

`pnpm audit --audit-level high` gates every pull request (decision 0006). On 2026-10-03 two high
advisories appeared for which **no patched version exists**:

| Advisory            | Package                        | Reached through                                            | Where it runs                             |
| ------------------- | ------------------------------ | ---------------------------------------------------------- | ----------------------------------------- |
| GHSA-ch52-4w7c-c8xp | `http-cache-semantics` ≤ 4.2.0 | `apps/docs` › Astro, Starlight                             | The documentation site's **static build** |
| GHSA-vfj7-8cjw-p6xm | `braces` ≤ 3.0.3               | `packages/views` › `vite-plugin-singlefile` › `micromatch` | The **build** of the generic views' page  |

The first discloses cached responses across users of a shared HTTP cache; the second exhausts the
stack on deeply nested glob patterns. Neither code path runs in a deployed service: the docs are
static files, and the glob patterns are ours, at build time. Every pull request is blocked until
someone decides.

## Decision Drivers

- The audit gate must stay strict: a new advisory still blocks.
- An exception names one advisory, says why it cannot be exploited here, and is reviewed.

## Considered Options

- Lower the gate to `critical`.
- Remove the docs site or the single-file build.
- Ignore exactly these two advisories by their identifiers, with this record.

## Decision Outcome

Chosen option: ignore exactly GHSA-ch52-4w7c-c8xp and GHSA-vfj7-8cjw-p6xm
(`auditConfig.ignoreGhsas` in `pnpm-workspace.yaml`), because the gate stays at `high` for
everything else and both paths are build-time only.

### Consequences

- Good, because pull requests flow again while the gate keeps catching any other advisory.
- Bad, because a fix published upstream is not picked up by itself: the review below does it.

### Confirmation

The CI's audit step; this list is reviewed at each release and removed as soon as a patched
version exists (`pnpm audit` without the exceptions shows them again).

## More Information

Reverse it when a patched `http-cache-semantics` or `braces` is released, or if either package
ever enters a deployed service's runtime dependencies.
