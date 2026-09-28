# Quickstart — validating 001 Contracts and SDK

## Prerequisites

- Node 22, pnpm, Docker (for a local Postgres) or access to the Neon `test` branch.
- `KETE_TEST_OWNER_URL` (migration role) and `KETE_TEST_DATABASE_URL` (application role without
  `BYPASSRLS`), as in [research R-09](research.md).

## Setup

```bash
pnpm install
pnpm contracts:generate     # regenerates types from contracts/; must produce no diff
pnpm check                  # lint, types, boundaries, formatting
```

## Scenarios

| # | Proves | Run | Expected |
|---|---|---|---|
| 1 | Atomic recording (US1, FR-006) | `pnpm --filter @kete/sdk test outbox` | A rolled-back change leaves no outbox row; a committed one leaves exactly one |
| 2 | Non-blocking when the receiver is down (US1, SC-004) | `pnpm --filter sample-app bench:offline` | Business change latency increases by less than 10% |
| 3 | Exactly-once end to end (US1, SC-001) | `pnpm chaos --changes 1000` | Receiver holds 1,000 events: 0 lost, 0 duplicated |
| 4 | Authenticity and freshness (US2, SC-003) | `pnpm --filter @kete/sdk test receiver` | Altered, wrong-key, unknown-app and stale deliveries refused with their reason codes |
| 5 | Key rotation (US2, FR-014) | `pnpm --filter @kete/sdk test rotation` | Old and new keys accepted during overlap; only the new one after |
| 6 | Manifest and health (US3, SC-006) | `pnpm --filter sample-app dev`, then `GET /.well-known/kete` and `GET /health` | Both valid against their contracts; stopping the database turns health to `degraded` within one check |
| 7 | Adoption (US4, SC-005) | Follow `packages/sdk/README.md` on `examples/minimal-app` | First event accepted by the test receiver in under 30 minutes |
| 8 | Isolation (constitution V) | `pnpm --filter @kete/sdk test rls` | An organization never reads another organization's outbox rows |

## Done when

All scenarios pass in CI on the pull request to `dev`, and `packages/sdk/README.md` contains the
event lifecycle and delivery sequence diagrams.
