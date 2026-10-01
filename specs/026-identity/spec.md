# Feature Specification: The identity, as a building block, and its OpenAPI description

**Feature Branch**: `026-identity`
**Created**: 2026-09-30
**Status**: Implemented
**Input**: Doctrine D-026 (an autonomous instance keeps its own identity, the Compte Kete's rules),
D-030 (`identity` is a building block extracted from the Compte Kete), D-032 (OpenAPI for HTTP
APIs). The Compte Kete's identity lived in `apps/account/src/platform`: Better Auth's configuration,
its tables, the sign-in methods, the OpenID provider.

## User Scenarios & Testing

### User Story 1 — One identity, several instances (P1)

1. **Given** `@kete/identity`, **When** an instance calls `createIdentity` with its database, its
   e-mails, its offers, its operators and its pages, **Then** it gets the Compte Kete's rules:
   passwords, passkeys, second factor, organizations and roles, invitations, sign-in links, and the
   OpenID provider with the Kete claims.
2. **Given** the Compte Kete on `@kete/identity`, **Then** it behaves exactly as before: its tests
   and its end-to-end tests pass unchanged, and drizzle-kit sees no schema change.

### User Story 2 — The Compte Kete's API, described (P1)

1. **Given** `pnpm openapi:generate`, **Then** `docs/generated/account.openapi.json` describes, in
   OpenAPI 3.1, the identity's endpoints (`/api/auth`) and the Compte Kete's own API (`/api/apps`,
   `/api/admin/offers`, `/api/payments/notifications`), whose request bodies are the schemas the
   routes validate with.
2. **Given** a change to an endpoint, **When** the description is not regenerated, **Then**
   `pnpm check` fails.
3. **Given** the documentation site, **Then** every operation has its page.

## Requirements

- **FR-001**: `@kete/identity`: `createIdentity`, `@kete/identity/schema`, `prefixedIds`,
  `signInMethodsOf`, `KETE_APPS_AUDIENCE`, `KeteClaims`, the phone placeholder helpers, and
  `identityOpenApi`. No server framework: the instance passes its cookie plugin.
- **FR-002**: The Compte Kete's `platform/auth.ts` configures it; `strength.ts`, `contact.ts`,
  `claims.ts`, `oauth.ts` and `auth-schema.ts` move into the package.
- **FR-003**: The request schemas of `/api/apps` and `/api/admin/offers` live in pure modules
  (`features/*/inputs.ts`), shared by the routes and the description.
- **FR-004**: `pnpm openapi:check` in `pnpm check`; the OpenAPI 3.0 habits of Better Auth's
  generator (`nullable`, a `json` type) are rewritten as OpenAPI 3.1 says.
- **FR-005**: The documentation site renders the description (`starlight-openapi`).

## Out of scope

- An OpenAPI description of Kete Cockpit's API: the Cockpit moves to its own repository (spec 029).
- Renaming the Compte Kete's French route files (`connexion.tsx`, …) in English: done by spec 036,
  without changing any address (virtual routes).
- Validating the description in CI with a linter: validated once with Redocly (valid, no error).

## Success Criteria

- **SC-001**: The Compte Kete's tests pass (9 files) and drizzle-kit reports no schema change.
- **SC-002** `[blocking]`: every Compte Kete end-to-end test passes unchanged, in CI.
- **SC-003**: The description is valid OpenAPI 3.1 (Redocly: no error) and up to date in CI.
