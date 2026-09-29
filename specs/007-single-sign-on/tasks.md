# Tasks: One sign-in for every Kete app

## Identity provider (Compte Kete)

- [x] T001 `@better-auth/oauth-provider` 1.7: OAuth 2.1 + OIDC, PKCE required, no dynamic registration, 15-minute JWT access tokens for `urn:kete:apps` (FR-001)
- [x] T002 Kete claims in access tokens from the organization active at sign-in (`postLogin.consentReferenceId`); `two_factor` claim (FR-002)
- [x] T003 Migration `0003_single_sign_on.sql` (OAuth and two-factor tables, `user.two_factor_enabled`)
- [x] T004 Sign-in, sign-up and the two-factor code page resume a Kete app's signed authorization request; plain query strings in the router so the signature survives
- [x] T005 Discovery at the issuer's root (`/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server`)
- [x] T006 Consent page for non-trusted clients (Kete's own apps skip it)
- [x] T007 Better Auth ready before serving: the first request after a start no longer fails

## Two-factor and operators

- [x] T008 `twoFactor` plugin; `/espace/securite` (turn on with QR code and backup codes, turn off); code page at sign-in (FR-004)
- [x] T009 Operators: owners/admins of `KETE_OPERATORS_ORGANIZATION_ID` with two-factor; only they register apps (`clientPrivileges`)
- [x] T010 `scripts/clients.ts`: an operator registers an app (https "web"; 127.0.0.1 "native" for development)

## Apps

- [x] T011 `@kete/auth` `createKeteSignIn`: start, callback, session, sign-out; framework-free (FR-003)
- [x] T012 `@kete/auth` identity carries `twoFactor`; default audience `urn:kete:apps`

## Admin API for Kete Cockpit

- [x] T013 Migration `0004_offers_admin.sql`: `admin_set_offer`, `admin_disable_offer` (definer, validated); catalog stays read-only otherwise
- [x] T014 `/api/admin/offers`: operator bearer token, re-checked in the database; provider products, set, disable (FR-005)
- [x] T015 Payment port `listProducts` (Chariow adapter, fake provider)

## Proof

- [x] T016 e2e `sso.spec.ts`: a witness app on `@kete/auth` registered by an operator; sign-in when not signed in, silent sign-in with organization and role, unregistered redirect refused, admin API 401/403 (SC-001, SC-002)
- [x] T017 `tests/admin.test.ts`: operator rules (org, role, two-factor, database), catalog writes at the provider price
- [ ] T018 Staging: `KETE_OPERATORS_ORGANIZATION_ID`, migrations `0003`–`0004`, the author's operator account with two-factor, then Kete Cockpit registered
