# Feature Specification: The Compte Kete by phone number

**Feature Branch**: `013-phone-identity`
**Created**: 2026-09-29
**Status**: Implemented
**Input**: Doctrine D-024 — "L'usager d'une app de messagerie a un Compte Kete qu'il n'a jamais eu à
créer." Needed by Firmo's phase 2 (identity).

## User Scenarios & Testing

### User Story 1 — A person is provisioned by a trusted app (P1)

A tradesman writes to Firmo on WhatsApp. Firmo, which has verified his number through the channel,
asks the Compte Kete for his person and organization — without e-mail, password or form.

**Acceptance Scenarios**:

1. **Given** a Kete app allowed to provision people (`kete:people`), **When** it sends a phone
   number never seen, **Then** a person is created with that number, and an organization of which
   she is the owner; `account.created` is announced.
2. **Given** the same number again, **Then** the same person and organization come back; nothing is
   created twice.
3. **Given** an app without that permission, or no token, **Then** it is refused (403, 401).

### User Story 2 — A one-time sign-in link lands in the app (P1)

**Acceptance Scenarios**:

1. **Given** a provisioned person, **When** the app asks for a sign-in link with a return address on
   its own origin, **Then** it gets a link valid a few minutes; opening it signs the person in on the
   Compte Kete (replacing any session in that browser) and lands on the return address, from where
   the app's single sign-on completes without a password.
2. **Given** a link already used, or expired, **Then** it signs nobody in.
3. **Given** a return address on another origin than the app's registered ones, **Then** no link is
   issued.

### User Story 3 — Mon espace Kete shows the number (P2)

1. **Given** a person provisioned by phone, **Then** Mon espace Kete shows her number, never the
   placeholder address that stands in for a missing e-mail.

## Requirements

- **FR-001**: `user.phone_number` (E.164, unique). A person without e-mail carries the placeholder
  `p<digits>@phone.kete.invalid` (RFC 2606 `.invalid`), never shown.
- **FR-002**: Apps authenticate with OAuth `client_credentials`; the scope `kete:people` is granted
  per client by an operator (`clients create --people`). The access token is verified against the
  Compte Kete's own keys; it carries no person.
- **FR-003**: `POST /api/apps/people` `{ phoneNumber, name?, organizationName? }` →
  `{ personId, organizationId, created }`.
- **FR-004**: `POST /api/apps/sign-in-links` `{ personId, returnTo }` → `{ url, expiresAt }`; the
  link is a Better Auth magic link (single attempt, hashed token, 10 minutes) whose callback,
  `/api/apps/continue`, checks the signed-in person and the link, then redirects to `returnTo`.
- **FR-005**: `returnTo` must share the origin of one of the calling app's redirect URIs.

## Success Criteria

- **SC-001**: Tests prove idempotent provisioning, refusals, single-use and origin checks.
