# Feature Specification: The Compte Kete's route files in English

**Feature Branch**: `036-account-route-files`
**Created**: 2026-10-01
**Status**: Delivered
**Input**: The author ("Renomme les anciens fichiers"); repository rule: everything in English, the
interface in French; the app template's pattern (spec 029, `src/routes.ts`).

## Why

The Compte Kete's screens were files named by their French addresses (`connexion.tsx`,
`espace/securite.tsx`, `[.]well-known/…`). The template already names its files in English and
declares its French addresses once, in `src/routes.ts` (virtual file routes). The Compte Kete now
does the same.

## User Scenarios & Testing

1. **Given** any address of the Compte Kete (screens, `/api/*`, `/.well-known/*`, `/health`),
   **Then** it answers exactly as before: no address changes, so no redirect is needed; apps,
   e-mailed links and the OpenID provider's sign-in and consent pages keep working.
2. **Given** a developer opening `src/routes`, **Then** every file is named in English, and
   `src/routes.ts` maps each one to its address.

## Requirements

- **FR-001**: `src/routes.ts` declares every route; `vite.config.ts` reads it
  (`virtualRouteConfig`).
- **FR-002**: renamed: `connexion` → `sign-in`, `connexion_.code` → `sign-in-code`, `inscription`
  → `sign-up`, `consentement` → `consent`, `invitation.$id` → `invitation/$id`, `espace` →
  `space/layout` and its pages (`subscriptions`, `new-organization`, `organization`, `settings`,
  `security`), `[.]well-known/*` → `well-known/*`, `health` → `api/health`.

## Success Criteria

- **SC-001**: the generated route tree lists the same 26 addresses as before.
- **SC-002**: every Compte Kete test and end-to-end test passes unchanged.
