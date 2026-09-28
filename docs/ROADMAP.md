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

## Phase 0 — Foundation · *in progress*

### Objective
A repository an agent can work in safely.

### Scope
- Constitution, agent context, Spec Kit. *(done)*
- `main` / `dev` branches, feature branches from `dev`. *(done)*
- pnpm workspace, TypeScript strict, lint, formatting, boundary checks, CI skeleton.

### Proof
- `[agent]` CI runs lint, type-check and tests on every pull request to `dev`.

---

## Phase 1 — Contracts and SDK · *next* (`specs/001-contracts-and-sdk`)

### Objective
Any Kete app can describe itself, report its health and send signed integration events reliably.

### Scope
- Contracts v1: `manifest`, `event`, `health` (JSON Schema, versioned, types generated).
- `@kete/sdk`: outbox written in the same transaction as the business change, batched signed
  delivery with retries, signature verification for receivers, `/health`, manifest.
- A test receiver, so the proof does not wait for Kete Cockpit.

### Dependencies
Phase 0.

### Proof
- `[agent]` A sample app records a business change and its event atomically; the event reaches the
  test receiver, is verified, and is never duplicated nor lost across simulated failures.
- `[agent]` A tampered or stale event is rejected.

---

## Phase 2 — Compte Kete and design system

### Objective
One account for every Kete app, and the visual foundation of every screen.

### Scope
- `apps/account` on Better Auth: e-mail sign-in, organizations, organization roles, invitations,
  the token carrying person, active organization, role and apps.
- Operator identity with mandatory two-factor authentication.
- `@kete/auth` for apps: reading the token, active organization, mapping to business roles.
- `@kete/design`: the **v1 rectangle** design system and its `DESIGN.md` (Google DESIGN.md format),
  kept in sync with the tokens and linted in CI.
- `@kete/files` (core): files separated from their stored content, attachments to records, direct
  uploads through a storage port (S3-compatible adapter first), type and size checks, scanning
  before availability, image renditions, time-limited share links, retention policies.
- Mon espace Kete, minimal: my tools, my organization (including its logo, through
  `@kete/files`), generic settings.

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

### Dependencies
Phase 2.

### Proof
- `[blocking]` A real payment activates access to an app; the sale is re-verified with the
  provider, never trusted from the webhook alone.

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
`@kete/ai` (model routing and budgets) · phone sign-in · additional payment adapters (Moneroo,
Stripe) · a Python SDK if a Python app needs it.
