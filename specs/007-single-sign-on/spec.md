# Feature Specification: One sign-in for every Kete app

**Feature Branch**: `007-single-sign-on`
**Created**: 2026-09-29
**Status**: Draft
**Input**: The author: "pour toute app, on a l'auth unique". Kete Cockpit (next repository) and
every Kete app live on their own address; each must sign people in with the Compte Kete, never
with its own passwords. Operators (Kete staff) need two-factor authentication and an admin API
to manage the offers catalog from Kete Cockpit.

## User Scenarios & Testing

### User Story 1 — A person opens a Kete app and is signed in with the Compte Kete (P1)

**Acceptance Scenarios**:

1. **Given** a person signed in to the Compte Kete, **When** they open a Kete app, **Then** the app
   signs them in without asking for a password again, and knows their active organization, role
   and apps.
2. **Given** a person not signed in, **When** they open a Kete app, **Then** they sign in on the
   Compte Kete and come back to the app.
3. **Given** an address that is not a registered Kete app, **Then** the Compte Kete refuses to
   send a sign-in to it.

### User Story 2 — Kete operators are strongly authenticated (P1)

**Acceptance Scenarios**:

1. **Given** a member of Kete's own organization, **When** they turn on two-factor
   authentication, **Then** signing in asks for a one-time code.
2. **Given** a token without two-factor authentication, **Then** an operator-only app or API
   refuses it.

### User Story 3 — Kete Cockpit manages the offers catalog through the Compte Kete (P2)

**Acceptance Scenarios**:

1. **Given** an operator token, **When** Kete Cockpit lists provider products and sets or disables
   an offer, **Then** the catalog changes; any other token is refused.

## Requirements

- **FR-001**: The Compte Kete is an OAuth 2.1 / OpenID Connect provider (authorization code with
  PKCE); Kete apps are registered, trusted clients (no consent screen); redirect addresses are
  exact matches.
- **FR-002**: Access tokens carry the Kete claims (person, active organization, role, apps,
  two-factor) and are verified by `@kete/auth` against the published keys.
- **FR-003**: `@kete/auth` gives apps the sign-in flow (start, callback, session), so no app writes
  its own.
- **FR-004**: Two-factor authentication (one-time codes) in Mon espace Kete; operators are members
  of Kete's organization, identified by configuration.
- **FR-005**: An admin API for offers (list provider products, list, set, disable), operator
  tokens with two-factor only.
- **FR-006**: Screens in French and English; usable at 375 px.

## Success Criteria

- **SC-001**: A registered app signs a person in end to end in a browser; an unregistered
  redirect address is refused.
- **SC-002**: 100% of admin API calls without an operator, two-factor token are refused.

## Assumptions

- Kete staff sign in with the same Compte Kete as clients; being an operator is a membership, not
  a separate account.
- Apps keep their own short session after sign-in; the Compte Kete remains the source of truth.
