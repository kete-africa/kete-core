# Roadmap — Kete Core

## Metadata

- **Status**: `candidate`
- **Last updated**: `2026-09-28`
- **Product boundary**: the shared foundation of every Kete app — contracts, shared packages, the
  Compte Kete service with Mon espace Kete, and the app template.
- **Planning axis**: `DEPENDENCIES_AND_EVIDENCE_NOT_TIME`
- **Deployment policy**: `HUMAN_VALIDATION_BEFORE_DEPLOY` (through Pono)

## Goal

A new Kete app starts from the template and is, from its first day: connected to the Compte Kete,
observable by Kete Cockpit, able to take payments through a generic port, and ready for agents
(drafts, commands, capabilities) — with purpose-built screens on the Kete design system.

## Execution rules

- Phases are contiguous and close on their **proof**, never on a date.
- Each phase is driven by Spec Kit: `specify → clarify → plan → tasks → analyze → implement →
converge`, one `NNN-slug` branch per feature, merged into `dev` on green CI only.
- A phase is not closed while its documentation and diagrams are missing.
- `[agent]` is verified automatically; `[blocking]` waits for a human decision or observation.

---

## Phase 0 — Foundation · _closed on the CI of pull request #1_

### Objective

A repository an agent can work in safely.

### Scope

- Constitution, agent context, Spec Kit. _(done)_
- `main` / `dev` branches, feature branches from `dev`. _(done)_
- pnpm workspace, TypeScript strict, lint, formatting, boundary checks, CI. _(done in 001)_

### Proof

- `[agent]` CI runs lint, type-check and tests on every pull request to `dev`.

---

## Phase 1 — Contracts and SDK · _delivered in `specs/001-contracts-and-sdk`, one human proof pending_

### Objective

Any Kete app can describe itself, report its health and send signed integration events reliably.

### Scope

- Contracts v1: `manifest`, `event`, `health` (JSON Schema, versioned, types generated).
- `@kete/sdk`: outbox written in the same transaction as the business change, batched signed
  delivery with retries, signature verification for receivers, `/health`, manifest.
- A test receiver, so the proof does not wait for Kete Cockpit.

### Status

- Proven (`packages/sdk/tests`): atomic recording, RLS isolation, relay under concurrency,
  verification and rotation, exactly-once, manifest and health. **Chaos run: 1,000 events, 1,050
  deliveries (50 duplicates absorbed), 0 lost** (SC-001).
- Pending: SC-005, an adoption timed by a person — when Nettio adopts the SDK.

### Dependencies

Phase 0.

### Proof

- `[agent]` A sample app records a business change and its event atomically; the event reaches the
  test receiver, is verified, and is never duplicated nor lost across simulated failures.
- `[agent]` A tampered or stale event is rejected.

---

## Phase 2 — Compte Kete and design system · _delivered; three human proofs pending_

### Objective

One account for every Kete app, and the visual foundation of every screen.

### Scope

- `apps/account` on Better Auth: e-mail sign-in, organizations, organization roles, invitations,
  the token carrying person, active organization, role and apps.
- Operator identity with mandatory two-factor authentication — moved to Kete Cockpit, where
  operators act (spec 003, assumptions).
- `@kete/auth` for apps: reading the token, active organization, mapping to business roles.
- `@kete/design`: the **v1 rectangle** design system and its `DESIGN.md` (Google DESIGN.md format),
  kept in sync with the tokens and linted in CI.
- `@kete/files` (core): files separated from their stored content, attachments to records, direct
  uploads through a storage port (S3-compatible adapter first), type and size checks, scanning
  before availability, image renditions, time-limited share links, retention policies.
- Mon espace Kete, minimal: my tools, my organization (including its logo, through
  `@kete/files`), generic settings.

### Status

- `specs/002-design-system` delivered: `DESIGN.md` linted with 0 warnings, generated theme checked
  in CI, first components. Author validation happens on the Compte Kete screens.
- `specs/003-compte-kete` delivered: accounts, organizations, roles, invitations, generic settings,
  the token and `@kete/auth`. Proven: isolation between two organizations in the database (SC-002),
  every altered, expired or foreign token refused (SC-003), the journeys in a browser on the
  production build. Pending: a timed sign-up by a person (SC-001) and the author's validation of
  the screens (SC-004).
- `specs/004-files` delivered: `@kete/files` on Neon object storage, the organization's logo in
  Mon espace Kete. Proven on the real database and storage: another organization can neither list,
  read nor reference a file; disguised or oversized files are refused and never served; no
  metadata of the original survives. Scope kept to images: documents wait for an antivirus
  adapter; share links, renditions and retention jobs come with the apps that need them.

### Dependencies

Phase 1.

### Proof

- `[agent]` A person creates an account, an organization, invites a member; two organizations never
  see each other (RLS test).
- `[agent]` An organization uploads its logo and a document; another organization can neither list
  nor download them; an unscanned or rejected file is never served.
- `[blocking]` The author validates the first screens against `DESIGN.md`.

---

## Phase 3 — Payments

### Objective

Take a real payment through a generic port.

### Scope

- `@kete/payments`: the payment port, the **Chariow** adapter first.
- Subscriptions centralized in the Compte Kete; access carried by the token with a grace period.
- "My subscriptions" in Mon espace Kete.

### Status

- Prerequisite delivered in `specs/005-staging`: the Compte Kete runs in staging on Coolify
  (branch `dev`), so providers can reach it and the author can validate screens on a phone.
- `specs/007-single-sign-on` delivered (prerequisite of Kete Cockpit): the Compte Kete signs people
  in to every Kete app (OAuth 2.1 / OIDC, `@kete/auth` `createKeteSignIn`), two-factor
  authentication, operators, and the offers admin API. Proven in a browser with a witness app.
- `specs/006-payments` delivered: `@kete/payments` with the Chariow adapter (checked read-only
  against the real API), offers set by operators from provider products, checkouts and
  subscriptions under RLS, notifications verified and applied once, access in the token
  (`canUse`). Proven in tests: forged, replayed, unpaid or mismatching sales grant nothing.
  Pending: the author's Pulse and a real payment on staging.

### Dependencies

Phase 2.

### Proof

- `[blocking]` A real payment activates access to an app; the sale is re-verified with the
  provider, never trusted from the webhook alone.

---

## Kete Cockpit (in this repository, decision D-022)

Where Kete operators run the Kete apps — doctrine step 1.

- **V0.1 — operators and the offers catalog** · _delivered in `specs/008-cockpit`_: operators sign
  in with their Compte Kete (two-factor), offer and withdraw products; proven in a browser.
  Pending: staging (Coolify) and the author's own sign-in.
- **V0.2 — the app registry** · _delivered in `specs/009-cockpit-registry`_: apps registered from
  their manifest, health read on a schedule, signed events received exactly once (key rotation);
  proven in a browser with the Compte Kete registered. Daily snapshots move to V0.3 with the brief
  that uses them.
- **Events from the Compte Kete** · _delivered in `specs/010-account-events`_: `account.created` and
  `payment.succeeded` through the outbox and its relay.
- **V0.3 — the brief and agents**: daily snapshots; the morning brief on Telegram; read-only MCP tools so an agent
  answers about the apps' state.

Proof of V0 (doctrine): an event from an app in production appears in the next morning's brief; a
simulated outage raises an alert; an agent answers about the apps' state.

---

## Firmo's needs (doctrine D-023, D-024)

Firmo is rewritten on this foundation in its own repository (`kete-africa/firmo`). It needs two
things from here, delivered before its conversation phase.

### 012 — Package distribution · _decision 0005, delivered_

- `@kete-africa/*` published on GitHub Packages by this repository's CI; apps keep importing
  `@kete/*` through aliases.
- `[agent]` Firmo installs them from the registry and passes its CI.

### 013 — The Compte Kete by phone number · _delivered in `specs/013-phone-identity`_

- A person whose phone number is proven by a messaging channel gets a Compte Kete without e-mail,
  password or form, provisioned by a trusted Kete app (Firmo) with its own client credentials;
  her business becomes an organization.
- A one-time, short-lived sign-in link, requested by the app for that person, opens the Compte
  Kete signed in and lands in the app through single sign-on.
- Mon espace Kete shows the phone number; e-mail and password can be added there.
- `[agent]` A test app provisions a person by phone, requests a link, and the link signs her into
  the app once — never twice, never after expiry, never for another app's return address.

---

## Phase 4 — AI-era primitives

### Objective

Apps let agents prepare and humans decide, the same way everywhere.

### Scope

- `@kete/records`: single schema per record, lifecycle, field provenance.
- `@kete/commands`: named commands, idempotency, actor, reversibility and inverse command, command
  journal.
- `@kete/drafts`: record drafts and change proposals, the verification card, agent states.
- `@kete/capabilities`: declaring agent-facing capabilities and their autonomy level; MCP exposure.
- `@kete/files` (extractions): text, transcription and extracted fields derived from a file (a
  photo, a voice note), used as the traced source of a draft.

### Dependencies

Phases 2 and 3.

### Proof

- `[agent]` An agent prepares a draft through MCP; a human verifies and validates it; the action is
  journaled with its actor and provenance.
- `[agent]` A draft prepared from a photo shows the photo next to the extracted fields.

---

## Phase 5 — App template

### Objective

A new Kete app is born complete.

### Scope

- `templates/app`: everything above wired, plus `@kete/admin` (operator space and audit),
  `@kete/notify`, `@kete/feedback`, i18n, documentation skeleton with diagrams, CI.

### Dependencies

Phase 4.

### Proof

- `[agent]` An app created from the template signs in with the Compte Kete, sends a verified
  event, exposes a capability, and passes CI on its first commit.

---

## Later, when a real need appears

`@kete/offline` (local command queue) · `@kete/sequences` (legal numbering) ·
`@kete/ai` (model routing and budgets) · phone sign-in by one-time code · additional payment adapters (Moneroo,
Stripe) · a Python SDK if a Python app needs it.
