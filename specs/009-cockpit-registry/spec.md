# Feature Specification: Kete Cockpit V0.2 — the app registry

**Feature Branch**: `009-cockpit-registry`
**Created**: 2026-09-29
**Status**: Implemented
**Input**: Doctrine step 1 (Kete Cockpit V0): the registry, health probes and event reception;
roadmap "Kete Cockpit V0.2".

## User Scenarios & Testing

### User Story 1 — An operator registers an app (P1)

**Acceptance Scenarios**:

1. **Given** an app's public address, **When** the operator registers it, **Then** the Cockpit
   reads its manifest (product, name, environment, version, declared events) and shows a signing
   key for its events — once.
2. **Given** an address that is not https (outside this machine), does not answer, has no valid
   manifest, or is already registered, **Then** it is refused, and the operator is told why.

### User Story 2 — The operator sees how each app is doing (P1)

**Acceptance Scenarios**:

1. **Given** registered apps, **Then** each shows its latest health (healthy, degraded, down,
   unreachable), its version, and its events of the last 24 hours; health is read on a schedule
   and on demand, with a history.

### User Story 3 — Apps deliver their events (P1)

**Acceptance Scenarios**:

1. **Given** a delivery signed with the app's key, **Then** each event is accepted once; a replay
   is a duplicate.
2. **Given** a forged signature, another product, an undeclared event type or a retired key,
   **Then** it is refused.
3. **Given** a key rotation, **Then** the previous key keeps working for a week.

## Requirements

- **FR-001**: Neon project `kete-cockpit` (branches `main`, `dev`, `test`), application role
  without BYPASSRLS; decision 0004.
- **FR-002**: Registry from the manifest (`/.well-known/kete`); signing secrets encrypted at rest.
- **FR-003**: Health readings (`/health`) every `COCKPIT_PROBE_INTERVAL_SECONDS`, one instance at
  a time (advisory lock), and on demand.
- **FR-004**: `/api/events` on `@kete/sdk`'s receiver: signed batches, exactly once, declared types.
- **FR-005**: Screens `/apps` and `/apps/$appId`, French and English, 375 px.

## Success Criteria

- **SC-001**: In a browser, an operator registers the Compte Kete, reads it healthy, and sees an
  event delivered with the shown key; a forged delivery is refused.
- **SC-002**: 100% of forged, foreign, undeclared or retired-key deliveries in the test set are
  refused.
