# Implementation Plan: Compte Kete

**Branch**: `003-compte-kete` | **Spec**: [spec.md](spec.md)

## Summary

`apps/account`: a TanStack Start service on Better Auth (e-mail and password, organization plugin,
JWT plugin), Drizzle on the Neon project `kete-account` (Frankfurt, branches `main` / `dev` /
`test`), screens on `@kete/design`, French and English through Paraglide. `packages/auth`
(`@kete/auth`) verifies the Compte Kete token in any app with `jose`, against the published keys.

## Technical context

| | |
|---|---|
| Runtime | Node 22, TanStack Start (React 19), Vite 7, served by srvx in production |
| Identity | Better Auth 1.7: `emailAndPassword`, `organization` (owner / admin / member, 7-day invitations), `jwt` (EdDSA, 15 min, audience `kete-apps`) |
| Data | Postgres 17 on Neon; roles `account_owner` (migrations) and `account_app` (no BYPASSRLS) |
| Isolation | Identity tables global (decision 0003); organization data under RLS keyed on `kete.organization_id`, set per transaction |
| Tests | Vitest integration on the `test` branch; Playwright on the production build |

## Constitution Check

| Principle | Status |
|---|---|
| I. Simple and working | Pass — six screens, one settings table, a static tools list until subscriptions |
| II. Human decides | Pass — nothing automatic beyond the person's own gestures |
| III. No vendor in the domain | Pass — e-mail through a port; Better Auth confined to `platform/auth.ts` and the auth client |
| IV. Contract first | Pass — token claims typed (`KeteClaims`) and verified by `@kete/auth`; manifest and health from `@kete/sdk` |
| V. Isolation in the creating migration | Pass — `organization_settings` created with its policy in `0000_init.sql` |
| VI. Bilingual | Pass — every visible string in `messages/{fr,en}.json`; `pnpm i18n:check` in CI |
| VIII. Nothing claimed without proof | Pass — SC-002 and SC-003 proven by tests; SC-001 and SC-004 need a person |

## Structure

```text
apps/account/
├── src/
│   ├── platform/     # auth, db, schema, actor (membership, inOrganization), email port, env, ids, service (manifest, health)
│   ├── features/     # identity (viewer, members, invitation preview), settings, tools (catalog)
│   ├── lib/          # auth client, shared UI (frame, language switch, notices, select)
│   └── routes/       # screens and machine endpoints
├── db/               # bootstrap.sql, migrations
├── tests/            # isolation (Vitest, Neon test branch)
└── e2e/              # browser journeys (Playwright, production build)
packages/auth/        # @kete/auth — createTokenVerifier
tooling/scripts/check-hardcoded-strings.ts
```

## Decisions taken while implementing

- **Invitations without a verified address** — Better Auth 1.7 requires a verified address to
  accept an invitation; with no mail provider, none can be verified. The link, handed to the
  invited person, is the proof until e-mail delivery exists (`requireEmailVerificationOnInvitation:
  false`, to be turned back on then).
- **Forms wait for hydration** — a form submitted before the page is interactive would send its
  fields natively (a password in the address bar). Forms use `method="post"` and their buttons stay
  disabled until hydration. Found by the end-to-end tests.
- **A new session opens on the person's first organization**, so apps always get one in the token
  when it exists.
- **End-to-end tests run the production build**: the dev server reloads pages while optimizing
  dependencies, which made journeys flaky.
