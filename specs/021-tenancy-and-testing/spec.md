# Feature Specification: Tenancy and testing kit

**Feature Branch**: `021-tenancy-and-testing`
**Created**: 2026-09-30
**Status**: Implemented
**Input**: Doctrine D-030. The organization's transaction was written three times — in the Compte
Kete (`platform/tenancy.ts`), in Firmo (`platform/tenancy.ts`) and in the SDK's tests — and every
table's isolation policy was written by hand. Every Kete product (apps, Kete Enterprise) needs the
same rule, proven on the real database, on Neon and on any client's Postgres.

## User Scenarios & Testing

### User Story 1 — One way to act for an organization (P1)

1. **Given** a service, **When** it runs work for an organization with `inOrganization` (pg) or
   `inOrganizationTx` (Drizzle), **Then** every RLS policy sees only that organization, and the
   setting resets at the end of the transaction.
2. **Given** an empty or malformed organization identifier, **Then** nothing runs.

### User Story 2 — A table cannot ship without its isolation (P1)

1. **Given** a migrated database, **When** `auditRls` runs, **Then** it names every table holding
   `organization_id` without row-level security or without a policy, except the tables global by
   decision.
2. **Given** a connection, **When** `assertRoleIsolated` runs, **Then** it throws if the role is a
   superuser or bypasses RLS.
3. **Given** the Compte Kete's `test` branch, **Then** its audit finds nothing and its role is
   isolated.

### User Story 3 — Tests on a real Postgres, anywhere (P1)

1. **Given** a test file, **When** it calls `createTestSchema`, **Then** it gets its own schema with
   the owner's and the application role's connections, and the application role's grants.
2. **Given** `KETE_TEST_POSTGRES=container`, **Then** the same tests run on a plain Postgres
   (Testcontainers, `pgvector/pgvector:pg17`) with an application role created like a service's.
3. **Given** two organizations and a table, **When** `assertOrganizationIsolation` runs, **Then** it
   proves each sees only its rows, nothing is visible unscoped, and neither can write the other's.

## Requirements

- **FR-001**: `@kete/tenancy` (building block, depends on `@kete/sdk` only): `inOrganization`,
  `organizationPolicySql`, `auditRls`, `checkRoleIsolation`, `assertRoleIsolated`,
  `RlsBypassError`, the setting's constants, and `setOrganization` re-exported from `@kete/sdk`.
- **FR-002**: `@kete/tenancy/drizzle`: `organizationIsolation` (a policy that reads exactly like a
  hand-written one, so existing migrations see no change) and `inOrganizationTx`; Drizzle is an
  optional peer dependency.
- **FR-003**: `@kete/testing` (depends on no Kete package, so every package can test with it):
  `testDatabaseUrls`, `startPostgres`, `createTestSchema`, `assertOrganizationIsolation`,
  `loadRepositoryEnv`.
- **FR-004**: The Compte Kete declares its four isolation policies with `organizationIsolation` and
  runs its transactions with `inOrganizationTx`; a test audits its database.
- **FR-005**: The SDK's tests create their schema with `@kete/testing`.
- **FR-006**: CI runs the tests of `tenancy`, `testing` and `sdk` on a container Postgres too.
- **FR-007**: The Compte Kete's Drizzle snapshot chain is repaired (migrations 0006 and 0007 had
  none), so `drizzle-kit generate` reports no change.

## Out of scope

- Firmo keeps its own `tenancy.ts` until it adopts the published package (apps lane, D-034).
- The Cockpit's data is operating data without RLS (decision 0004).

## Success Criteria

- **SC-001**: The tests of `tenancy` (11) and `testing` (3) pass on the Neon `test` branch and in a
  container.
- **SC-002**: The Compte Kete's audit test passes; its end-to-end tests pass unchanged.
- **SC-003**: `pnpm --filter @kete/account exec drizzle-kit generate` reports no schema change.
