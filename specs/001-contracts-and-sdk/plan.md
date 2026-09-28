# Implementation Plan: Contracts and SDK

**Branch**: `001-contracts-and-sdk` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-contracts-and-sdk/spec.md`

## Summary

Publish three versioned contracts (manifest, event, health) plus the delivery batch contract, and
ship `@kete/sdk`: an outbox written in the caller's transaction, a relay that delivers signed
batches with retries, receiver-side verification with exactly-once processing, and
framework-agnostic manifest and health handlers. The workspace tooling that closes roadmap phase 0
(pnpm, TypeScript strict, lint, boundaries, CI) is set up as this feature's first step.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 22

**Primary Dependencies**: Ajv (JSON Schema 2020-12 validation), json-schema-to-typescript (type
generation), Drizzle ORM and `pg` (outbox adapter), `uuid` (UUIDv7), Node `crypto` (HMAC)

**Storage**: PostgreSQL (Neon) — `kete_outbox` in each app's database; a dedupe table on the
receiver side

**Testing**: Vitest; integration tests on a real Postgres (local container, Neon `test` branch in CI)

**Target Platform**: Node 22 servers (apps and their workers), deployed on Coolify

**Project Type**: TypeScript library in a pnpm monorepo, plus a sample app and a test receiver

**Performance Goals**: 95% of events accepted within 60 s when the receiver is up (SC-002); batch
of 100 events per request

**Constraints**: recording adds < 10% latency to a business change when the receiver is down
(SC-004); batch ≤ 256 KB; freshness window 300 s; no `BYPASSRLS` for the application role

**Scale/Scope**: a handful of apps at first, thousands of events per day per app

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How |
|---|---|---|
| I. Simple and working | Pass | One library, one sample app, one test receiver; no broker, no new infrastructure |
| II. Current step only | Pass | Receiving is limited to what Kete Cockpit will need; Python SDK deferred |
| III. Generic first | Pass | Ports: `OutboxStore`, `Transport`, `DedupeStore`, `KeyRing`; Postgres and HTTP are adapters |
| IV. Contract first | Pass | JSON Schema in `contracts/`, types generated and checked in CI |
| V. Security in the database | Pass | Outbox table created with its RLS policy; cross-organization claim through `SECURITY DEFINER` functions (research R-03) |
| VI. AI prepares, human decides | N/A | No agent action in this feature |
| VII. Every app stays autonomous | Pass | Outbox in the same transaction; delivery never blocks a user |
| VIII. Nothing claimed without proof | Pass | Proofs in [quickstart.md](quickstart.md), mapped to SC-001…SC-006 |

Post-design re-check: **pass**, no violation to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-contracts-and-sdk/
├── spec.md
├── plan.md              # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/           # draft contracts, moved to /contracts on implementation
├── checklists/
└── tasks.md             # next step (/speckit-tasks)
```

### Source Code (repository root)

```text
contracts/
├── event.v1.schema.json
├── delivery.v1.schema.json
├── manifest.v1.schema.json
└── health.v1.schema.json

packages/
└── sdk/                         # @kete/sdk
    ├── README.md                # usage + event lifecycle and delivery sequence diagrams
    ├── src/
    │   ├── contracts/           # generated types and compiled validators (do not edit)
    │   ├── events/              # standard event types, per-type data schemas, defineEvents()
    │   ├── outbox/              # OutboxStore port, recordEvent(), relay (claim, deliver, settle, backoff)
    │   │   └── postgres/        # Drizzle table, SQL migration with RLS, claim/settle functions
    │   ├── signing/             # sign(), verify(), KeyRing with rotation
    │   ├── delivery/            # Transport port, HTTP adapter
    │   ├── receiver/            # processDelivery(), DedupeStore port, Postgres adapter
    │   ├── health/              # health report builder, GET /health handler
    │   ├── manifest/            # kete.json loading and validation, GET /.well-known/kete handler
    │   └── index.ts             # the package's only public entry point
    └── tests/

examples/
├── sample-app/                  # a minimal app using the SDK (scenarios 2 and 6)
├── minimal-app/                 # the adoption exercise, without the SDK (scenario 7)
└── test-receiver/               # the reference receiver used for the proofs

tooling/
├── tsconfig/                    # shared strict configuration
├── eslint/                      # flat config, boundaries rules
└── scripts/                     # contracts:generate, chaos test

.github/workflows/ci.yml         # lint, types, boundaries, tests, generated-files check
```

**Structure Decision**: a pnpm monorepo. Contracts at the root are shared by every package and by
future non-TypeScript clients. `@kete/sdk` is one package organized by responsibility, each folder
exposing only what `src/index.ts` re-exports; examples live outside `packages/` so they are never
published.

## Complexity Tracking

No constitution violation to justify.
