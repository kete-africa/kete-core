# Feature Specification: The Compte Kete announces its events to Kete Cockpit

**Feature Branch**: `010-account-events`
**Created**: 2026-09-29
**Status**: Implemented
**Input**: Doctrine step 1 proof — "an event from an app in production appears in the next
morning's brief". The Compte Kete is the first app to announce.

## User Scenarios & Testing

### User Story 1 — What happens in the Compte Kete reaches the Cockpit (P1)

**Acceptance Scenarios**:

1. **Given** a new organization, **Then** `account.created` is announced for it.
2. **Given** a payment that opens access, **Then** `payment.succeeded` (amount in the currency's
   smallest unit, currency, the provider's sale) is announced in the same transaction as the
   access — never one without the other, and once however many times the sale is confirmed.
3. **Given** the Cockpit's address and key, **Then** the relay delivers the outbox, signed; without
   them, events wait in the outbox.

## Requirements

- **FR-001**: The SDK outbox in the Compte Kete database (migration `0005_outbox.sql`, created with
  its RLS policy and definer functions).
- **FR-002**: The manifest declares `account.created` and `payment.succeeded`; `/health` reports the
  outbox backlog.
- **FR-003**: The relay runs in the Compte Kete (`KETE_EVENTS_URL`, `KETE_EVENTS_KID`,
  `KETE_EVENTS_SECRET`), every 10 s by default.

## Success Criteria

- **SC-001**: In tests on the real database, both events are recorded as specified and delivered
  signed to a receiver, which marks them delivered.

## Assumptions

- `account.created` follows the organization in its own transaction (Better Auth commits the
  organization first); `payment.succeeded` is fully atomic with the access it grants.
