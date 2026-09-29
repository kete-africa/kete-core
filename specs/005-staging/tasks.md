# Tasks: Compte Kete in staging

- [x] T001 `apps/account/Dockerfile` and `.dockerignore`; CI job `image` builds, starts and requires `/health` healthy (FR-001)
- [x] T002 Coolify source `kete-coolify` owned by `kete-africa`, on `kete-core` only (author's gesture)
- [x] T003 Coolify project `Kete`, environment `staging`, application `kete-account-staging` on `dev` (FR-002)
- [x] T004 Runtime-only environment: app role, staging auth secret, `dev` storage credential; CORS on the `dev` bucket
- [x] T005 Migrations of `dev` applied with the owner role before deploy (FR-003)
- [x] T006 Playwright against a deployed address (FR-004)
- [x] T007 `docs/OPERATIONS.md` with the deploy flow (FR-005)
- [x] T008 e2e against staging: 9/9 (SC-001)
- [ ] T009 `[blocking]` Deploy-only Coolify token, then CI deploys after a green push on `dev`
- [ ] T010 `[blocking]` The author validates the screens on a phone (SC-002)
