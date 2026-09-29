# Implementation Plan: One sign-in for every Kete app

**Branch**: `007-single-sign-on` | **Spec**: [spec.md](spec.md)

## Summary

The Compte Kete becomes the identity provider of every Kete app with Better Auth's official
`@better-auth/oauth-provider` (OAuth 2.1, OpenID Connect, PKCE required). Apps are trusted clients
registered by operators; their access tokens are JWTs signed with the keys the Compte Kete already
publishes, carrying the Kete claims, verified by `@kete/auth`. `@kete/auth` gains the relying-party
side (start, callback, session cookie) so each app gets sign-in in a few lines. Two-factor
authentication comes from Better Auth's `twoFactor` plugin. An admin API lets Kete Cockpit manage
the offers catalog.

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as Kete app (e.g. Cockpit)
  participant C as Compte Kete
  B->>A: open a page
  A-->>B: redirect to C /api/auth/oauth2/authorize (client_id, redirect_uri, PKCE, resource)
  B->>C: authorize (signs in if needed, 2FA if enabled; trusted client: no consent)
  C-->>B: redirect to A /auth/callback?code=…
  B->>A: callback
  A->>C: POST /api/auth/oauth2/token (code, verifier, client secret)
  C-->>A: access token (JWT: sub, org, role, apps, two_factor) + id token
  A->>A: @kete/auth verifies against C's published keys; sets its own session cookie
```

## Decisions

| Question | Choice | Why |
|---|---|---|
| Protocol | OAuth 2.1 authorization code + PKCE, OIDC | Standard; every future app, and agents (MCP), use the same door |
| Library | `@better-auth/oauth-provider` 1.7 | Official, same version line as Better Auth; replaces the deprecated `oidcProvider` |
| Token format | JWT with `resource` = the Kete apps audience | Verified locally by `@kete/auth`; no call per request |
| Claims | `org`, `role`, `apps`, `two_factor`, `email`, `name` | What apps and Cockpit decide on |
| Clients | Trusted, `skip_consent`, exact redirect URIs, registered by an operator script | No consent screen between Kete's own apps; no open registration |
| Operators | Members (owner/admin) of the organization named by `KETE_OPERATORS_ORGANIZATION_ID`, two-factor on | Same account as everyone; strength where it matters |
| App session | Short signed cookie in each app, re-authorized through the Compte Kete | The Compte Kete stays the source of truth |

## Constitution Check

| Principle | Status |
|---|---|
| I. Simple and working | Pass — one standard flow, one library, one verifier |
| III. No vendor in the domain | Pass — the protocol is standard; Better Auth stays in `platform/auth.ts` |
| V. Isolation | Pass — tokens carry the active organization; apps isolate by it |
| VIII. Proof | SC-001 and SC-002 proven by tests, including a browser flow with a test client |
