# Feature Specification: Kete Cockpit in its own repository

**Feature Branch**: `030-cockpit-repository`
**Created**: 2026-10-01
**Status**: Delivered (2026-10-01) — kete-core no longer holds the Cockpit; the staging Coolify application switches to its repository
**Input**: Doctrine D-033 (the Cockpit leaves kete-core with its history and consumes the published
packages), D-022 (it stays in kete-core while the packages are not published), D-034 (lanes).

## The condition

`kete-africa/kete-cockpit` can only install `@kete-africa/*` from GitHub Packages once they are
published, that is once specs 020 to 029 are merged into `main` and released. Until then the
Cockpit stays in kete-core (D-022): nothing is created on GitHub before.

## User Scenarios & Testing

### User Story 1 — A reproducible move (P1)

1. **Given** `pnpm cockpit:extract --ref origin/main --out ../kete-cockpit`, **Then** a repository is
   created with every commit that touched `apps/cockpit` (`git subtree split`), and one commit that
   makes it stand alone: its packages from the registry at their published versions, its TypeScript
   options inlined, its Dockerfile, CI, `.npmrc`, `CLAUDE.md`.
2. **Given** `--install --push`, **Then** its lockfile is written from the published packages and
   `kete-africa/kete-cockpit` (private) is created and pushed.

### User Story 2 — Nothing lost (P1)

1. **Given** the Cockpit's end-to-end test, which builds the Compte Kete from kete-core's sources,
   **Then** it waits in `e2e-pending/` until the Compte Kete's image is published, and runs from it.

## Where it stands (2026-10-01)

- Done: #20 → #31 merged, the packages published (0.1.0; design and sdk 0.2.0), the repository
  created with its history, its secrets (`COCKPIT_TEST_*`, `KETE_PACKAGES_TOKEN`), its CI green
  (types, migration, tests, image).
- Learned on the way, now in the script and the template: the token never in a committed
  `.npmrc`; the repository's own token cannot read another repository's packages
  (`KETE_PACKAGES_TOKEN`); `pnpm-workspace.yaml` (approved builds) and `.dockerignore` travel
  with the app; `@types/node` came from kete-core's root.
- Removed from kete-core: `apps/cockpit`, its CI steps, its workspace entries.
- Left to the author: the Coolify GitHub App installed on the new repository, and the staging
  application built from it (build secret `node_auth_token`).

## The move, in order

1. Merge #20 → #29 into `dev`, then `dev` into `main` (the author's gesture).
2. Release: the Changesets pull request versions the packages; merging it publishes them.
3. `pnpm cockpit:extract --ref origin/main --out ../kete-cockpit --install --push`.
4. In `kete-africa/kete-cockpit`: the secrets `COCKPIT_TEST_OWNER_URL` and `COCKPIT_TEST_APP_URL`
   (Neon `kete-cockpit` test branch); CI green.
5. Coolify: the Cockpit's application builds from the new repository (build secret
   `node_auth_token`), redeployed on staging, `/health` green.
6. In kete-core, a pull request removes `apps/cockpit` and its CI steps (migration, tests, e2e,
   image).

## Requirements

- **FR-001**: `tooling/scripts/extract-cockpit.ts` (`pnpm cockpit:extract`), remote steps behind
  `--install` and `--push` only.

## Success Criteria

- **SC-001**: A local run keeps the Cockpit's history (9 commits from `origin/dev` today) and adapts
  it; nothing remains in kete-core (its temporary branch is removed).
- **SC-002** `[blocking]`: after publication, the Cockpit is green in its own repository and
  redeployed on staging; kete-core no longer holds it.
