# Research — 001 Contracts and SDK

Each entry: **Decision**, **Rationale**, **Alternatives considered**.

## R-01 Contract format and type generation

- **Decision**: contracts are JSON Schema (draft 2020-12) files in `contracts/`, versioned by file
  name (`event.v1.schema.json`). TypeScript types are generated from them
  (`json-schema-to-typescript`); runtime validation uses compiled Ajv validators. Generated files
  are committed and CI fails if regenerating them produces a difference.
- **Rationale**: constitution IV (contract first); a language-neutral format keeps a future Python
  or other client possible; committed, checked generation keeps docs and code honest (D-017).
- **Alternatives**: Zod as source with JSON Schema exported (rejected: makes TypeScript the source
  of a cross-language contract); hand-written types (rejected: drift).

## R-02 Outbox storage and transactional write

- **Decision**: each app has a `kete_outbox` table in its own database. `recordEvent(tx, event)`
  writes into the caller's transaction, so the business change and its event commit or roll back
  together. The SDK ships the table definition (Drizzle), its SQL migration and its RLS policy.
- **Rationale**: FR-006; constitution VII (outbox in the same transaction) and V (RLS in the
  creating migration).
- **Alternatives**: publishing after commit (rejected: loses events on crash); change data capture
  (rejected: heavier infrastructure than one Postgres table).

## R-03 Delivering across organizations without bypassing RLS

- **Decision**: the relay claims pending rows through a `SECURITY DEFINER` function owned by the
  migration role (`kete_outbox_claim(batch_size, lease_seconds)`), which returns only envelope
  columns and uses `FOR UPDATE SKIP LOCKED` with a lease. Acknowledgements go through
  `kete_outbox_settle(...)`. The application role never gets `BYPASSRLS`.
- **Rationale**: constitution V; several relay instances can run safely.
- **Alternatives**: a bypass role for the worker (rejected: widens the attack surface); a relay
  per organization (rejected: does not scale).

## R-04 Delivery transport and retries

- **Decision**: HTTPS `POST` of a JSON batch (up to 100 events, 256 KB) to the receiver. The
  response lists an outcome per event: `accepted`, `duplicate`, or `refused` with a reason code.
  Transient failures are retried with exponential backoff and jitter, from 5 seconds up to 1 hour,
  without limit; definitive refusals are marked and never retried. Delivery is at-least-once.
- **Rationale**: FR-008, SC-001, SC-002; batches suit low bandwidth.
- **Alternatives**: a message broker (rejected: new infrastructure); one request per event
  (rejected: chatty on weak networks).

## R-05 Signature

- **Decision**: HMAC-SHA256 over `"{timestamp}.{raw body}"` with the app's secret. Headers:
  `Kete-Product: <product id>` and `Kete-Signature: t=<unix seconds>,kid=<key id>,v1=<hex>`.
  Verification uses a constant-time comparison, a 300-second freshness window, and a key ring
  keyed by `kid` so two keys overlap during rotation.
- **Rationale**: FR-009, FR-011, FR-014; the receiver is operated by Kete, so a shared secret per
  app is sufficient (doctrine).
- **Alternatives**: asymmetric signatures (not needed yet); mutual TLS (heavier to operate).

## R-06 Exactly-once at the receiver

- **Decision**: event identifiers are `evt_` + UUIDv7 (time-ordered). The receiver stores accepted
  identifiers under a unique constraint and answers `duplicate` for a known one. The SDK exposes
  `processDelivery()` with a `DedupeStore` port and a Postgres adapter.
- **Rationale**: FR-012, SC-001.
- **Alternatives**: content hashing (rejected: two identical facts can be distinct events).

## R-07 Manifest and health endpoints

- **Decision**: framework-agnostic handlers based on the Web `Request`/`Response` API:
  `GET /.well-known/kete` returns the validated manifest (`kete.json`); `GET /health` returns the
  health report with each dependency's state and the outbox backlog (pending count, oldest age).
  They mount in TanStack Start server routes or any Fetch-compatible server.
- **Rationale**: FR-015, FR-016; no coupling to one framework.
- **Alternatives**: framework-specific middleware (rejected: locks apps to one server).

## R-08 Workspace and tooling (closes roadmap phase 0)

- **Decision**: pnpm workspace; Node 22; TypeScript strict with project references; ESLint (flat
  config, typescript-eslint) and Prettier; boundaries enforced by `eslint-plugin-boundaries`;
  Vitest; GitHub Actions CI on every pull request to `dev`.
- **Rationale**: doctrine D-016 and FLUX; phase 0 proof is "CI runs on every pull request".
- **Alternatives**: Turborepo (not needed at this size); Biome (single tool, but the ecosystem
  rules for boundaries live in ESLint).

## R-09 Test database

- **Decision**: integration tests run against a real Postgres: a local container during
  development, the Neon branch `test` in CI, through `KETE_TEST_DATABASE_URL` and
  `KETE_TEST_OWNER_URL`. Two roles are bootstrapped: an owner for migrations, an application role
  without `BYPASSRLS`.
- **Rationale**: RLS and `SKIP LOCKED` must be tested on Postgres itself.
- **Alternatives**: an in-process Postgres (rejected: role and RLS behavior not reliable enough).
