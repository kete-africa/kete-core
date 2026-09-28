# Feature Specification: Compte Kete

**Feature Branch**: `003-compte-kete`
**Created**: 2026-09-28
**Status**: Implemented — SC-001 and SC-004 wait for a person
**Input**: Roadmap phase 2 — one account for every Kete app (doctrine D-011: Better Auth, e-mail
sign-in), organizations and organization roles, the token apps read, and a minimal Mon espace Kete
(doctrine D-013) on the v1 rectangle design system.

## User Scenarios & Testing

### User Story 1 — A person creates their Kete account and their organization (P1)

A pressing owner signs up with an e-mail and a password, creates their organization, and lands in
Mon espace Kete, where they see their tools.

**Independent Test**: sign up, create an organization, see "My tools" — in a browser.

**Acceptance Scenarios**:
1. **Given** a new e-mail, **When** the person signs up, **Then** an account exists and they are
   signed in.
2. **Given** a signed-in person without an organization, **When** they open Mon espace Kete, **Then**
   they are asked to create one, and become its owner.
3. **Given** an existing e-mail, **When** someone signs up with it, **Then** it is refused without
   revealing more than necessary.

### User Story 2 — The owner invites a member with a role (P1)

**Acceptance Scenarios**:
1. **Given** an owner, **When** they invite an e-mail as member or administrator, **Then** an
   invitation exists and can be accepted once, by that e-mail only.
2. **Given** a member, **When** they try to invite or change roles, **Then** it is refused.
3. **Given** a person in two organizations, **When** they switch the active organization, **Then**
   everything they see belongs to that organization only.

### User Story 3 — Generic settings, entered once (P2)

The owner or an administrator sets the company identity (name, address, contacts, legal
identifiers), language, time zone, currency and preferred notification channels, used by every
Kete app.

**Acceptance Scenarios**:
1. **Given** an administrator, **When** they save settings, **Then** they are stored for the active
   organization only.
2. **Given** two organizations, **Then** neither can read or change the other's settings (database
   isolation).

### User Story 4 — Apps trust the Compte Kete token (P2)

A Kete app verifies a token issued by the Compte Kete and reads who the person is, the active
organization and the role — without calling the Compte Kete on every request.

**Acceptance Scenarios**:
1. **Given** a valid token, **Then** an app reads person, organization and role.
2. **Given** an expired, altered or foreign token, **Then** the app refuses it.

### Edge Cases

- A person signs up while an invitation is pending for their e-mail: the invitation stays usable.
- An invitation expires, or is used twice: refused with a clear message.
- The last owner cannot leave or be demoted.
- E-mail delivery is not configured: invitations still work through their link; e-mail
  verification and password reset wait for a mail provider (stated on screen).

## Requirements

- **FR-001**: Sign up, sign in, sign out with e-mail and password.
- **FR-002**: Organizations with roles owner, admin, member; invitations by e-mail with expiry.
- **FR-003**: An active organization per session; switching is explicit.
- **FR-004**: Generic organization settings, isolated per organization in the database (RLS).
- **FR-005**: A signed token (with public keys published) carrying person, active organization,
  role; `@kete/auth` verifies it for apps.
- **FR-006**: Every screen in French by default and English, on the v1 rectangle design system,
  usable at 375 px wide.
- **FR-007**: Identifiers are prefixed (`usr_`, `org_`), compatible with the event contract.
- **FR-008**: The service exposes its manifest and health (`@kete/sdk`).

## Success Criteria

- **SC-001**: A person goes from sign-up to Mon espace Kete in under 2 minutes.
- **SC-002**: The isolation test between two organizations passes on the database.
- **SC-003**: An app refuses 100% of altered, expired or foreign tokens.
- **SC-004** *(blocking, human)*: the author validates the screens against `DESIGN.md`.

## Assumptions

- No e-mail provider yet (no personal SMTP account): e-mails go through a port with a log adapter;
  an SMTP adapter comes when an account exists. Until then an invitation is accepted without a
  verified address: its link, handed to the invited person, is the proof.
- The list of Kete apps in "My tools" is static configuration until subscriptions (phase 3).
- Operator identity (Kete staff with mandatory two-factor authentication) comes with Kete Cockpit,
  where operators act.
