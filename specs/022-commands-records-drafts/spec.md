# Feature Specification: Commands, records and drafts

**Feature Branch**: `022-commands-records-drafts`
**Created**: 2026-09-30
**Status**: Implemented
**Input**: Doctrine D-030 and CONCEPTION A.1 to A.6, 7, 10 and 11 — roadmap phase 4. Every Kete
product (the apps, Kete Enterprise) needs the same gestures: named commands with their actor and
idempotency, one schema per record, and drafts an agent prepares and a person decides. Firmo and the
Compte Kete had started writing parts of them on their own (the Drizzle-to-SQL adapter twice,
prefixed identifiers, lifecycles).

## User Scenarios & Testing

### User Story 1 — Every gesture is a named, journaled command (P1)

1. **Given** a command and an actor (who, on behalf of whom, through which channel), **When** it
   runs in its organization's transaction, **Then** the change and its journal entry commit
   together, with whether it can be undone and by which command.
2. **Given** the same idempotency key and input, **Then** the stored result is replayed and nothing
   runs again; with another input, the command is refused.
3. **Given** a failing handler, **Then** nothing is left behind and the key stays free.
4. **Given** the journal, **Then** the application role can only add to it and read it, and only
   for its organization — enforced by the database.
5. **Given** a Kete operator setting or disabling an offer in the Compte Kete, **Then** the gesture
   is journaled with the operator, the `api` channel and its inverse, and a retried request is
   replayed.

### User Story 2 — A record is described once (P1)

1. **Given** a record's Zod schema with field metadata, **Then** its fields (label key, required,
   personal, to verify) and its JSON Schema are derived from it.
2. **Given** the lifecycle draft → to verify → validated → cancelled or archived, **Then** other
   transitions are refused, and only a validated record counts.
3. **Given** personal fields, **Then** they can be redacted for logs and exports.
4. **Given** money, **Then** it is an integer of the smallest unit with its currency.

### User Story 3 — The AI prepares, a person decides (P1)

1. **Given** an agent's draft, **Then** it has no effect until validated, and each field carries its
   provenance (source, by whom, certainty, evidence).
2. **Given** a person's correction, **Then** each corrected field becomes "typed" by her, and the
   prepared values are kept.
3. **Given** a validation, **Then** only a person can make it; it runs the same use case as the
   screen in the same transaction, keeps the corrections, and leaves the draft waiting if the use
   case fails.
4. **Given** a decided draft, **Then** the database refuses any change to it.

## Requirements

- **FR-001**: `@kete/commands`: `defineCommand`, `executeCommand`, `readJournal`,
  `commandsMigrationSql`, the actor schema (`person`, `agent`, `service`, `app`; nine channels).
- **FR-002**: `@kete/records`: `defineRecord`, `field`, `describeFields`, `redactPersonal`, the
  lifecycle, `newId` (`prefix_` + UUID v7), money.
- **FR-003**: `@kete/drafts`: `prepareDraft`, `correctDraft`, `validateDraft`, `refuseDraft`,
  `getDraft`, `listDrafts`, `draftsMigrationSql` (a restrictive policy freezes decided drafts).
- **FR-004**: `@kete/tenancy/drizzle` gains `sqlExecutorOf`; the Compte Kete drops its own copy.
- **FR-005**: The Compte Kete's `set-offer` and `disable-offer` are commands; its migration 0008
  creates `kete_commands`; the admin API honours an `Idempotency-Key` header.

## Moved to spec 027

The doctrine's interface components (verification card, agent states, confirmation of an
irreversible gesture, notification with "Annuler") are built with the design system's three layers,
so they are built once, in spec 027.

## Success Criteria

- **SC-001**: `commands` (8), `records` (11) and `drafts` (8) tests pass on the Neon `test` branch
  and in a container.
- **SC-002**: The Compte Kete's admin tests prove the journal and the replay; its RLS audit passes
  with `kete_commands`.
