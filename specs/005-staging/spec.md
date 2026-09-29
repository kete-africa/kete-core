# Feature Specification: Compte Kete in staging

**Feature Branch**: `005-staging`
**Created**: 2026-09-29
**Status**: Implemented — author validation of the screens (003 SC-004) now possible
**Input**: Roadmap phase 3 prerequisite — payments need a public address for provider
notifications, and the author validates screens from a phone.

## User Scenarios & Testing

### User Story 1 — The author opens the Compte Kete from a phone (P1)

**Acceptance Scenarios**:

1. **Given** a merge into `dev` with green CI, **When** staging is deployed, **Then** the Compte
   Kete answers at its staging address over HTTPS, reports `healthy`, and every browser journey
   passes against it.

### User Story 2 — Staging holds no more power than it needs (P1)

**Acceptance Scenarios**:

1. **Given** the running container, **Then** it holds only the application role (no owner role,
   no BYPASSRLS), a storage credential anchored on `dev`, and its own auth secret.
2. **Given** the repository, **Then** the hosting side can read `kete-core` only, and no
   instance-wide hosting token is stored in GitHub.

## Requirements

- **FR-001**: A container image built from the repository root, checked in CI (builds, starts,
  reports healthy on the `test` branch).
- **FR-002**: A staging application following `dev`, on the `dev` database and storage.
- **FR-003**: Migrations run before deploy with the owner role, outside the container.
- **FR-004**: The e2e suite runs against a deployed address (`ACCOUNT_E2E_BASE_URL`).
- **FR-005**: Operations documented (`docs/OPERATIONS.md`).

## Success Criteria

- **SC-001**: The e2e suite passes against staging.
- **SC-002** _(blocking, human)_: the author validates the screens on a phone (spec 003, SC-004).

## Assumptions

- No custom domain yet: the default `sslip.io` address of the server.
- Automatic deploy from CI waits for a deploy-only hosting token (author's gesture).
