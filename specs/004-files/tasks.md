# Tasks: Files (core) and the organization logo

## Setup

- [x] T001 Buckets `files` on `main`, `dev`, `test` of `kete-account`; a test-branch storage credential; CI secrets
- [x] T002 Probe Neon object storage: put/get/head/delete, presigned PUT/GET, CORS, content-type binding, download name

## Package `@kete/files`

- [x] T003 `ObjectStorage` port, `memoryStorage`, key validation (FR-001)
- [x] T004 `s3Storage` with presigned uploads and downloads (FR-002)
- [x] T005 `prepareImage`: real format, byte and pixel bounds, orientation, WebP re-encoding, no metadata (FR-003)
- [x] T006 Tests: images, and the storage contract on memory and on Neon

## Compte Kete

- [x] T007 Migration `0001_files.sql`: `files` under RLS, `logo_file_id` with a same-organization composite key (FR-004)
- [x] T008 `features/files/logo.ts`: request, complete (decide once), replace, remove; administrators only
- [x] T009 Logo in the settings view through a short-lived address
- [x] T010 Logo panel, French and English, client-side type and size hints (FR-005)
- [x] T011 `storage:cors` script; CORS set on the test bucket
- [x] T012 Integration tests on the real database and storage (SC-001, SC-002, SC-003)
- [x] T013 e2e: upload a logo, a disguised file refused, a member sees it without controls

## Polish

- [x] T014 READMEs, roadmap
- [ ] T015 Set storage CORS and credentials on `dev` and `main` when the Compte Kete is deployed
- [ ] T016 A job that purges pending uploads left behind (with the job runner)
