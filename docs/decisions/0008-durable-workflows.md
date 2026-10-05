---
status: proposed
date: 2026-10-05
decision-makers: the author (Jean-Claude), proposed by the agent; to be accepted by the author
---

# 0008 — Durable workflows: DBOS Transact, only when a process needs it

## Context and Problem Statement

The roadmap planned « a workflows engine » for long, durable processes. By 2026-10-05 the
products' long-running work is covered by three pieces that already exist:

| Need                                                   | Covered by                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| A request approved step by step, with thresholds       | Kete Enterprise's decisions engine (spec 005), forms (spec 032)   |
| Work done later, on a schedule, retried                | pg-boss through `@kete/jobs` (agents' rounds, tasks, mails)       |
| A task handed between agents, its chain and trace kept | Agent tasks (Enterprise spec 036) and `@kete/commands` delegation |

No product has yet needed what a workflow engine adds: a process of many steps that must resume
exactly where it stopped after a crash or a deployment, with each step run once. Building that
engine now would be building without a need; choosing it now avoids reinventing it when the need
comes.

## Decision Drivers

- Doctrine: use what exists; no service in its own container unless nothing of the same quality
  runs in-process (2026-10-04).
- Postgres is every product's only state; a workflow's state belongs there, under RLS.
- TypeScript, Node 22, the same transactions as the commands and the journal.

## Considered Options

- **DBOS Transact** (MIT): durable workflows as a library, state in the product's Postgres.
- **Temporal**: a cluster of its own — a service, and its own store.
- **Inngest / Trigger.dev / Restate**: hosted or self-hosted services; licenses and hosting vary.
- **Our own engine on pg-boss**: steps as jobs, state in our tables — what DBOS already is.

## Decision Outcome

Chosen option: **DBOS Transact, adopted by the first process that needs durability**, because it
gives durable, exactly-once steps in-process over the product's own Postgres, with no service to
run. Until then, the decisions engine, pg-boss and agent tasks stay the tools; no workflow engine is
built or added.

The trigger is concrete: a process of three or more steps that calls outside systems (an app, a
provider, the factory) and must resume after a restart without repeating a step — for example an
employee's onboarding across apps, or an app's creation by the factory.

### Consequences

- Good, because nothing is built or run without a need, and the choice is ready when it comes.
- Good, because DBOS keeps the state in Postgres, under the product's RLS and backups.
- Bad, because its first adoption will need a spec of its own: its tables, its place beside
  `@kete/commands` and `@kete/jobs`, its tests.

### Confirmation

A spec that introduces a durable multi-step process cites this decision and uses DBOS; a review
refuses a hand-made workflow engine.

## More Information

Reversed if DBOS stops being maintained, changes its license, or needs a service of its own. See
the doctrine's « use what exists » (D-034) and the decision of 2026-10-04 on extra services.
