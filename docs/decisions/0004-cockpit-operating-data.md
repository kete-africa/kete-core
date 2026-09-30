---
status: accepted
date: 2026-09-29
---

# 0004 — Kete Cockpit's data is Kete's operating data, without row-level security

## Context and Problem Statement

Applies to `apps/cockpit` (Neon project `kete-cockpit`). Does Kete's own operating data need
row-level security when there is no tenant to separate?

## Decision Outcome

The Cockpit's tables — the app registry, signing keys, health readings, received events — hold
**Kete's own operating data**, seen as a whole by Kete operators. They carry no row-level security
policy: there is no tenant to separate. They are reached only through code that has checked the
operator (the Cockpit's session: Kete's organization, owner or admin, second factor) or through
the event endpoint, which accepts signed deliveries only.

The application role still has **no BYPASSRLS** (it was created in SQL, as Neon's API-created roles
bypass RLS), so any client-facing table added later gets its policy in its creating migration
(constitution V).

### Consequences

Why it is safe:

- Events carry facts and counters only — no names, e-mails or phone numbers (event contract);
  client organizations appear as opaque identifiers.
- Signing secrets are encrypted at rest (AES-256-GCM, `COCKPIT_ENCRYPTION_KEY`) and shown once.

## More Information

**What would reverse it**: the Cockpit opening to other product owners (doctrine: "Kete Cockpit
ouvert aux autres porteurs"): each owner's apps then become a tenant, isolated by RLS like every
client-facing table.
