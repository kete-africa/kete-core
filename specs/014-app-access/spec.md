# Feature Specification: What an app may know, and paying without an e-mail

**Feature Branch**: `014-app-access`
**Created**: 2026-09-29
**Status**: Implemented
**Input**: Firmo's phase 5 (plans and quota): Firmo applies its own quota rule to the Compte Kete's
subscription; a person provisioned by phone (spec 013) must be able to pay.

## User Scenarios & Testing

1. **Given** a trusted app (`kete:people`), **When** it asks which apps an organization may use,
   **Then** it gets each app and the date its access ends — dates only, never a price, a name or a
   payment; a malformed organization id is refused.
2. **Given** a person provisioned by phone, **When** she pays for an offer, **Then** she is asked
   the e-mail address of the receipt (her account has none), and the payment starts with it; a
   person with an e-mail is never asked.

## Requirements

- **FR-001**: `GET /api/apps/access?organizationId=` for trusted apps.
- **FR-002**: `receiptEmail` on checkout, required only without an account e-mail; never the
  placeholder address.

## Success Criteria

- **SC-001**: Tests prove both (account tests).
