# Feature Specification: Tooling and documentation site

**Feature Branch**: `020-tooling-and-docs`
**Created**: 2026-09-30
**Status**: Implemented
**Input**: Doctrine D-030, D-032 and D-034. Before the shared building blocks land, the repository
releases, updates, guards and documents itself with recognized tools rather than scripts of its
own, and the author can publish its documentation in one command.

## User Scenarios & Testing

### User Story 1 — Versions and changelogs by Changesets (P1)

1. **Given** a pull request that changes a published package, **When** it carries no changeset,
   **Then** CI fails and says how to add one (`pnpm changeset`).
2. **Given** changesets merged on `dev`, **When** a release branch runs `pnpm release:version`,
   **Then** each changed package gets its new version and a `CHANGELOG.md` entry.
3. **Given** a version not yet in GitHub Packages on `dev`, **Then** the Packages workflow publishes
   it with `changeset publish`, and never overwrites a published version (decision 0005).
4. **Given** the apps (`@kete/account`, `@kete/cockpit`, the docs site), **Then** they are never
   versioned nor published.

### User Story 2 — Guards in CI (P1)

1. **Given** a secret in the repository or its history, **Then** the `secrets` job (gitleaks) fails
   without printing the value.
2. **Given** a dependency with a high or critical advisory, **Then** CI fails (`pnpm audit`).
3. **Given** an unused file, an unused or unlisted dependency, or an unresolved import, **Then** CI
   fails (Knip).
4. **Given** dependency updates, **Then** Renovate proposes them to `dev`, grouped, once a week.

### User Story 3 — A documentation site in one command (P1)

1. **Given** the repository, **When** the author runs `pnpm docs:build`, **Then** a static site is
   produced from the repository's own Markdown: architecture, roadmap, operations, flows, decisions,
   every package's README, the contracts, and each package's API generated from its code.
2. **Given** the site, **Then** it follows Diátaxis (how-to guides, reference, explanation), renders
   Mermaid diagrams, and has search.
3. **Given** a broken internal link, **Then** the build fails.
4. **Given** `pnpm docs:dev`, **Then** the author reads the site locally while editing.

### User Story 4 — Decisions in MADR (P2)

1. **Given** a technical decision, **Then** it follows the MADR template in `docs/decisions/`, with
   its status, date and deciders; existing decisions are aligned without changing what they decided.

## Requirements

- **FR-001**: `@changesets/cli`, `.changeset/config.json` (base branch `dev`, private packages
  neither versioned nor tagged, restricted access); `pnpm changeset status` on pull requests; the
  Packages workflow publishes with `changeset publish --no-git-tag`.
- **FR-002**: `renovate.json` targeting `dev`, weekly, with groups for Better Auth, TanStack, Drizzle,
  Astro and Starlight, minor and patch updates.
- **FR-003**: A `secrets` CI job running the gitleaks container on the whole history, redacted.
- **FR-004**: `pnpm audit --audit-level high` in `pnpm check`.
- **FR-005**: Knip (`knip.json`) for files, dependencies, unlisted dependencies, binaries and
  unresolved imports, in `pnpm check`. Unused exports are not checked yet: the shared building
  blocks will reshape the packages' surfaces (specs 021 and later).
- **FR-006**: `apps/docs`: Astro with Starlight, `starlight-typedoc` for each published package,
  `starlight-links-validator`, `astro-mermaid`. Its content is generated from the repository's
  Markdown by a sync script (titles from the first heading, links rewritten to site routes); the
  generated content is not committed. `pnpm docs:dev`, `pnpm docs:build`; the build runs in CI.
- **FR-007**: A Dockerfile serving the built site, so it can be deployed on Coolify.
- **FR-008**: `docs/decisions/template.md` (MADR 4); decisions 0001 to 0005 carry MADR front matter.
- **FR-009**: Decision 0006 records these tools.

## Out of scope, with where it lands

- The OpenAPI description of the Compte Kete API: with `@kete/identity` (spec 026).
- AsyncAPI for events: with the event catalog of `@kete/capabilities` (spec 023).
- Code scanning (CodeQL) needs GitHub Advanced Security on private repositories: not now.

## Success Criteria

- **SC-001**: `pnpm check` passes with Changesets, Knip and the audit; CI runs the `secrets` job.
- **SC-002**: `pnpm docs:build` produces the site with every package's API and no broken link.
- **SC-003**: A package change without a changeset fails CI; with one, it passes.
