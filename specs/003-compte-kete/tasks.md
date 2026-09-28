# Tasks: Compte Kete

## Setup

- [x] T001 Neon project `kete-account` (Frankfurt, PG 17), branches `main` / `dev` / `test`, roles `account_owner` / `account_app` (`db/bootstrap.sql`)
- [x] T002 App skeleton: TanStack Start, Tailwind 4 + `@kete/design`, Paraglide (fr, en), Drizzle, srvx
- [x] T003 Decision 0003: identity tables global, organization data under RLS

## User story 1 — account and organization (P1)

- [x] T004 Better Auth: e-mail and password (10 characters minimum), prefixed identifiers (FR-001, FR-007)
- [x] T005 Schema and migration `0000_init.sql`, with `organization_settings` and its policy (FR-004)
- [x] T006 Screens `/connexion`, `/inscription`, `/espace/nouvelle-organisation`, `/espace` (tools)
- [x] T007 A new session opens on the person's first organization (FR-003)
- [x] T008 e2e: sign-up → organization → tools; duplicate address refused with a neutral message

## User story 2 — invitations and roles (P1)

- [x] T009 Organization plugin: owner / admin / member, 7-day invitations, e-mail port with log adapter (FR-002)
- [x] T010 `/espace/organisation`: members, role changes, pending invitations, invitation link
- [x] T011 `/invitation/$id`: preview, sign up or sign in, accept once
- [x] T012 Organization switcher (FR-003)
- [x] T013 e2e: invitation accepted once, by the invited address; a member can neither invite nor change settings

## User story 3 — generic settings (P2)

- [x] T014 `features/settings`: role check, `inOrganization`, validation (FR-004)
- [x] T015 `/espace/parametres`, read-only for members
- [x] T016 Isolation test on the database and in the service (SC-002)

## User story 4 — token for apps (P2)

- [x] T017 JWT plugin: EdDSA, 15 min, audience `kete-apps`, claims `sub`, `email`, `name`, `org`, `role`; keys at `/api/auth/jwks` (FR-005)
- [x] T018 `@kete/auth`: `createTokenVerifier`, refusals tested — altered, expired, foreign key, other issuer or audience, unsigned, malformed claims (SC-003)
- [x] T019 e2e: a token from a live session is verified by `@kete/auth` against the published keys

## Polish

- [x] T020 `/health` and `/.well-known/kete` through `@kete/sdk` (FR-008)
- [x] T021 375 px without horizontal scroll; English switch (FR-006)
- [x] T022 `pnpm i18n:check`: no hard-coded visible text
- [x] T023 CI: migrate the `test` branch, integration tests, e2e on the production build
- [x] T024 READMEs with diagrams (`apps/account`, `packages/auth`), plan, roadmap
- [ ] T025 `[blocking]` SC-001: a person goes from sign-up to Mon espace Kete in under 2 minutes, timed
- [ ] T026 `[blocking]` SC-004: the author validates the screens against `DESIGN.md`
