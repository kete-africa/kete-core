# Feature Specification: The chain of agents behind a gesture

**Feature Branch**: `034-actor-delegation`
**Created**: 2026-10-01
**Status**: Delivered
**Input**: Doctrine D-039 (permanent agents: delegations only narrow, every gesture carries its
chain up to a person, an agent never decides for a person), principle 4.

## Why

Agents will work for other agents (D-039). Every Kete App's journal must still say who acted, for
whom, and **at whose request**, or nobody can tell any more who wanted what. This is the only part
of D-039 that every Kete App needs: the agents, their tokens and their narrowing live in
`kete-enterprise` (D-028).

## User Scenarios & Testing

### User Story 1 — The journal keeps the chain (P1)

1. **Given** Ama's agent asks an analyst agent, which runs `create-deposit`, **Then** the journal
   entry names the analyst as the actor, Ama as `onBehalfOf`, Ama's agent in `delegatedBy`, and the
   task's `traceId`; `readJournal(db, { traceId })` gives every gesture of that task.
2. **Given** a gesture nobody delegated, **Then** its chain is empty and its trace null, as before.

### User Story 2 — A chain that does not go back to a person is refused (P1)

1. **Given** a chain on an actor that is not an agent, or acting for anyone but a person, or with a
   repeated agent, or longer than `MAX_DELEGATION_DEPTH` (4), **Then** the command is refused
   (`invalid_actor`) and nothing runs.

## Requirements

- **FR-001**: `actorSchema` accepts `delegatedBy` (agents only, 1 to 4, each once, not the actor)
  and `traceId`; a chain requires an agent acting `onBehalfOf` a person. Actors without a chain are
  unchanged.
- **FR-002**: `commandsDelegationMigrationSql` adds `delegated_by` (a JSON array) and `trace_id` to
  `kete_commands`, additive and idempotent; RLS and the append-only grants are unchanged.
- **FR-003**: `executeCommand` journals the chain; `readJournal` returns it and filters by trace.
- **FR-004**: the app template runs the migration (`0002_kete_delegation`); the package README
  documents the chain with its diagram.
- **FR-005**: `AuditLog` (`@kete/admin/ui`) shows "at the request of …" when given the label; the
  template's journal screen does, in both languages.

- **FR-006**: the Compte Kete, which keeps its own journal, adds the columns in its migration
  `0009_command_delegation`, applied to the Neon `dev` branch before merging; the `main` branch is
  migrated before `dev` is promoted to `main`.

## Out of scope

- Issuing narrowed tokens to agents (OAuth token exchange and its `act` claim): `kete-enterprise`.
- Showing the chain on a draft's review: when the first delegated agent prepares a draft.

## Success Criteria

- **SC-001**: `packages/commands` tests: the chain journaled and filtered by trace; every refused
  chain refused; actors without a chain still accepted.
