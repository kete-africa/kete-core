# Spec 150 — Standing mandates: an agent acts for a person while she is away

Doctrine D-062 (R5) and ADR 0018: an agent receives the apps' tools through federation, with its
person's mandate (spec 049). A mandate is exchanged from her token — so an agent woken by a routine
or by an event it follows, while she is away, held no token of hers and reached none of the apps'
tools. This spec lets her give the mandate ahead of time, and take it back.

## Requirements

- **FR-001 — Given once, with her consent.** The center (scope `kete:mandate`) presents her own
  token and the agent: the Compte Kete keeps a standing mandate — her, the agent, the center's
  client, her organization. Given again, it is renewed, never doubled.
- **FR-002 — Her claims as they are now.** At each use the center asks for the agent's mandate of
  now: the Compte Kete reads her claims again (`claimsOf` — role, apps, plans, second factor) and
  signs the mandate of spec 049 — the same `act` naming the agent and the center — for ten minutes.
  Never her claims of the day she gave it.
- **FR-003 — Taken back.** She withdraws it in Mon espace Kete (Sécurité · « Agents qui agissent
  pour toi »), or the center does (the agent removed). Withdrawn, nothing more is signed.
- **FR-004 — Never more than her.** Refused to any client but the one it was given to; refused once
  she is no longer a member of the organization.
- **FR-005 — Isolated.** `standing_mandates` carries its row-level security policy in its own
  migration (`0014_standing_mandates`).

## The flow

```mermaid
sequenceDiagram
  participant P as Person
  participant E as Kete Enterprise (the center)
  participant K as Compte Kete
  participant A as App
  P->>E: « let this agent act for me while I am away »
  E->>K: POST /api/apps/standing-mandates · her token, the agent
  K-->>E: grant smd_…
  Note over E: later — a routine, an event the agent follows; she is away
  E->>K: POST /api/apps/standing-mandates/token · organization, grant
  K->>K: withdrawn? another client? still a member? her claims, read again
  K-->>E: a mandate · sub = her, act = the agent · ten minutes
  E->>A: the app's tools, with the mandate
  P->>K: Mon espace · Sécurité · « Retirer »
  K-->>E: the next use is refused
```

## Proof

- `apps/account/tests/standing-mandates.test.ts`: given twice, one grant; her role changed since,
  the mandate says the new one, with the agent in `act`; another client is refused; she withdraws
  it, then nothing is signed; someone else cannot withdraw it for her; the center withdraws it; she
  leaves the organization, nothing is signed.
- `packages/auth/tests/standing-mandates.test.ts`: the center's client — the three calls, and
  nothing when refused or without its own token.

## Left for later

- The center's side lives in Kete Enterprise: the consent in an agent's panel, the grant kept per
  agent and person, the apps' tools given to an agent's background task.
