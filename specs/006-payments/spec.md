# Feature Specification: Payments and subscriptions

**Feature Branch**: `006-payments`
**Created**: 2026-09-29
**Status**: Implemented — the real payment waits for the author
**Input**: Roadmap phase 3 — take a real payment through a generic port, Chariow first;
subscriptions centralized in the Compte Kete; access carried by the token with a grace period.

## User Scenarios & Testing

### User Story 1 — An owner pays for a tool (P1)

From Mon espace Kete, an owner or an administrator chooses an offer (a tool for a period), gives
the phone number used to pay, pays on the provider's page, and comes back to see the tool active
until a date.

**Acceptance Scenarios**:

1. **Given** an offer, **When** the owner pays and the provider confirms the sale, **Then** the
   tool is active for the offer's period, then for a grace period.
2. **Given** an active tool, **When** the owner pays again before the end, **Then** the period is
   extended from its end, not from today.
3. **Given** a member, **Then** they see the subscriptions but cannot pay.

### User Story 2 — Nothing is granted without a confirmed, matching sale (P1)

**Acceptance Scenarios**:

1. **Given** a forged, altered or unsigned notification, **Then** it is refused.
2. **Given** a genuine notification for a sale the provider does not report as paid, **Then**
   nothing is granted.
3. **Given** a paid sale for another product or amount, **Then** nothing is granted and it is kept
   for an operator.
4. **Given** the same notification twice, or a notification and the person's return at once,
   **Then** access is granted once.

### User Story 3 — Apps know what the organization may use (P2)

**Acceptance Scenarios**:

1. **Given** an organization with an active tool, **Then** the Compte Kete token lists it with the
   end of its access, and `@kete/auth` answers `canUse`.

### User Story 4 — Operators set offers without a deployment (P2)

**Acceptance Scenarios**:

1. **Given** a product in the provider's dashboard, **When** an operator sets it as an offer (app,
   days, grace), **Then** it appears in Mon espace Kete with the provider's price.

## Requirements

- **FR-001**: A payment port (`@kete/payments`): start a checkout, read a sale, read a product,
  verify a notification; the Chariow adapter; a fake provider for tests.
- **FR-002**: Catalog `offers` (global, read-only for the service), `checkouts` and
  `subscriptions` under RLS, created with their policies; notifications recorded once.
- **FR-003**: A notification finds its organization through the checkout that started the sale
  (a definer function), never through echoed metadata.
- **FR-004**: `/espace/abonnements`, French and English, 375 px; the tools page shows access.
- **FR-005**: The token carries `apps` (end of access per tool); `@kete/auth` exposes `canUse`.
- **FR-006**: `scripts/offers.ts` sets, lists and disables offers from provider products.

## Success Criteria

- **SC-001**: 100% of forged, replayed, unpaid or mismatching sales in the test set grant nothing.
- **SC-002** _(blocking, human)_: a real payment on staging opens access to a tool.

## Assumptions

- The provider has no recurring billing and no test mode: a subscription is a paid period,
  renewed by paying again; the real proof costs a real (small) payment.
- The store, its products and its notification endpoint are created in the provider's dashboard
  by the author.
