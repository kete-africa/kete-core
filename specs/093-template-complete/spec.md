# Spec 093 — The template, born complete

Step **B7** of the plan decided on 2026-10-13 (`docs/ROADMAP.md`, phase 7); it answers
`kete-core#86`, the pieces Nettio had to write because the chassis did not have them.

## Why

Nettio was built on the published packages only, and still wrote eight pieces itself. Steps B1 to
B6 put the channels, the outbox, the agents' runtime, memory, logs, usage and offers in the
chassis. What remained were small pieces every app writes on day one — and the template, which
did not use any of the new ones. A new app must be born with them.

```mermaid
flowchart TB
  C[@kete/capabilities] -->|business roles · performGesture · RuleError| T[templates/app]
  D[@kete/design] -->|SelectField · CheckField · ChoiceField · TextAreaField · notes| T
  U[@kete/auth] -->|signSession| T
  A[@kete/agents] -->|« Demander »| T
  N[@kete/notify] -->|WhatsApp · Telegram| T
  Y[@kete/analytics · @kete/log] -->|usage · logs| T
  T -->|pnpm create @kete-africa/app| G[a new app, CI green on its first commit]
```

## What changes

- **Business roles** (`@kete/capabilities`): a permission names the roles of the trade that hold
  it by default (`businessRoles`); the owner ticks or unticks per role; with `businessRoleOf`, a
  member holds what her role holds and nothing without one. Owners and administrators keep their
  defaults; a managing center still wins. Tables `kete_business_roles` and
  `kete_business_role_permissions`, with their RLS.
- **A gesture on a screen** (`@kete/capabilities`): `performGesture` answers `{ ok, output }` or
  `{ ok: false, code, facts }`; a `RuleError` thrown by a domain function or a command is a code,
  never a crash.
- **Form fields** (`@kete/design`): `SelectField`, `CheckField`, `ChoiceField`, `TextAreaField`,
  `ErrorNote`, `InfoNote` — semantic tokens only, shaped like `TextField`.
- **A session for browser tests** (`@kete/auth`): `signSession` writes the cookie the sign-in
  writes; the sign-in itself now uses it.
- **The template** uses all of it, with « Demander » (readings only), WhatsApp and Telegram
  webhooks and delivery, usage and its daily counts, logs; `kete.json` declares `metrics.daily`
  and says it calls a model when one is configured.

## Not in this spec

A flow diagram (listed in `kete-core#86`, not part of B7); offline for a counter; Playwright in the
template itself (the session is ready for it); Nettio and Firmo adopting the pieces — their lanes.

## Proof

- `templates/app/tests/complete.test.ts` (7): a member holds what her business role holds, nothing
  without one; a broken rule comes back as `already_done`; « Demander » says it is not connected
  without a model, answers with the readings and is offered nothing that changes anything; a
  WhatsApp message is heard for the organization of its number and answered from it; a gesture is
  counted and the day's counts reach the outbox to Cockpit; a browser test's session is read by the
  app as its own. The 14 earlier tests of the template pass.
- `packages/capabilities/tests/business-roles.test.ts` (6), `packages/design/tests/fields.test.tsx`
  (3), `packages/auth/tests/session.test.ts` (2).
- `packages/create-app/tests/create.test.ts`: a generated app keeps no trace of the template's
  name and says it calls a model; CI runs the template's tests as a project of this repository.
