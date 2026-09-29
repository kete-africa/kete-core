# Feature Specification: Kete Cockpit V0 — operators and the offers catalog

**Feature Branch**: `008-cockpit`
**Created**: 2026-09-29
**Status**: Draft
**Input**: The author: the offers catalog is managed in Kete Cockpit (« ma réponse est dans le
cockpit »); decision D-022: Cockpit lives in `kete-core` as its own app. First slice of the
doctrine's step 1 (Kete Cockpit V0); the app registry, events, brief and agent access follow.

## User Scenarios & Testing

### User Story 1 — An operator opens Kete Cockpit (P1)

A Kete operator opens the Cockpit and is signed in with their Compte Kete; anyone else is kept
out.

**Acceptance Scenarios**:

1. **Given** a Kete operator (Kete's organization, owner or admin, two-factor on), **When** they
   open the Cockpit, **Then** they are signed in through the Compte Kete and see the Cockpit.
2. **Given** a client of Kete, or an operator without two-factor, **Then** the Cockpit refuses
   them and says why (and where to turn on two-factor).

### User Story 2 — An operator manages the offers catalog (P1)

**Acceptance Scenarios**:

1. **Given** products in the payment provider's store, **When** the operator opens the offers
   page, **Then** they see the current offers and the products not yet offered.
2. **When** they make a product an offer (app, days, grace), **Then** it appears in Mon espace
   Kete with the provider's price.
3. **When** they withdraw an offer, **Then** it disappears from Mon espace Kete; existing
   subscriptions are untouched.

## Requirements

- **FR-001**: `apps/cockpit`, its own app and deployment, on the Kete design system,
  French and English, usable at 375 px.
- **FR-002**: Sign-in with the Compte Kete (`@kete/auth`), operators only; the access token is kept
  in the Cockpit's session to call the Compte Kete admin API, and never reaches the browser.
- **FR-003**: Offers page on `/api/admin/offers`.
- **FR-004**: The Compte Kete can run with a fake payment provider for development and tests
  (never in production).
- **FR-005**: Registering an app asks the operator's password and code interactively; nothing
  secret goes through arguments or files.

## Success Criteria

- **SC-001**: In a browser, an operator signs in to the Cockpit and creates then withdraws an offer
  that Mon espace Kete shows then hides.
- **SC-002**: 100% of non-operators are refused by the Cockpit.
- **SC-003** _(blocking, human)_: the author signs in to the staging Cockpit with two-factor.
