# Feature Specification: The template of a Kete App

**Feature Branch**: `029-app-template`
**Created**: 2026-10-01
**Status**: Implemented
**Input**: Roadmap phase 5 ("a new Kete app is born complete"), doctrine ARCHITECTURE_APP (the
layout, the layers, one image two roles), D-037 (views), D-038 (an app's own design), and the
author's request: `@kete/admin`, `@kete/feedback`, the background jobs (pg-boss).

## User Scenarios & Testing

### User Story 1 — An app born complete (P1)

1. **Given** `pnpm create @kete-africa/app nettio --design=workspace`, **Then** a repository is
   created: named, in its design, its `@kete/*` packages from GitHub Packages at their published
   versions, with its context for agents, its documentation (architecture, first decision, a flow),
   its Dockerfile (web and worker) and its CI.
2. **Given** the template in kete-core, **Then** it builds, type-checks and passes its tests in
   kete-core's CI: the template never rots.

### User Story 2 — Every surface under the same rules (P1)

1. **Given** the example feature (tasks), **Then** a screen, an agent through MCP and its copilot's
   view all go through the same registry: same rights by role, same journal, same autonomy (list:
   level 1 as a table; complete: level 2, undo named; create: level 3, a draft decided in the view).
2. **Given** two organizations, **Then** each sees only its own tasks (RLS).

### User Story 3 — Operators, feedback, jobs (P1)

1. **Given** `@kete/admin`, **Then** only an owner or admin of Kete's organization, signing in
   strongly and still one now, passes; operator gestures are journaled commands; the Compte Kete's
   admin API uses it unchanged in behavior.
2. **Given** `@kete/feedback`, **Then** a person's feedback is kept in her organization, the page
   without its query; an agent cannot give feedback.
3. **Given** `@kete/jobs`, **Then** e-mails queued by the web process are sent by the worker; a
   provider's refusal is final, an outage is retried.
4. **Given** the template, **Then** its journal page shows owners and admins every gesture, agents
   included.

### User Story 4 — An app's own design (P2)

1. **Given** `design/DESIGN.md` and `design/semantic.ts`, **Then** `pnpm design:generate` writes its
   CSS, refused when a contrast fails; Kete's names are refused.

## Requirements

- **FR-001**: `templates/app` (TanStack Start, virtual routes: English files, French addresses),
  in the workspace and in CI.
- **FR-002**: `@kete/create-app`: `createApp`, its CLI, its prepack (template, versions).
- **FR-003**: `@kete/jobs`, `@kete/admin` (and `@kete/admin/ui`), `@kete/feedback` (and
  `@kete/feedback/button`): client-safe entries ship no server code.
- **FR-004**: `@kete/design/generate` (`readDesign`, `generateAppDesign`), shared with kete-core's
  own generator.

## Out of scope

- E-mail verification, the app's first real feature, its registration at the Compte Kete and in
  Kete Cockpit (operator gestures).
- Lint and formatting configuration inside the generated app (kete-core lints the template).

## Success Criteria

- **SC-001**: The template's 9 tests pass on the Neon test branch (MCP draft decided in the view,
  undo named, rights by role, RLS, manifest, catalogs).
- **SC-002**: jobs (4), admin (5), feedback (4), create-app (4) and design (24) tests pass; the
  Compte Kete's admin tests (8) pass unchanged on `@kete/admin`.
- **SC-003** `[blocking]`: once the packages are published, an app created with
  `pnpm create @kete-africa/app` passes its CI on its first commit.
