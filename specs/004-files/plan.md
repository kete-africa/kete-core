# Implementation Plan: Files (core) and the organization logo

**Branch**: `004-files` | **Spec**: [spec.md](spec.md)

## Summary

`packages/files` (`@kete/files`): the `ObjectStorage` port, `s3Storage` (AWS SDK v3, path-style,
presigner) and `memoryStorage`, and `prepareImage` (sharp: real format, pixel bound, orientation,
re-encode to WebP, no metadata). `apps/account`: the `files` table under RLS, the logo flow in
`features/files`, the logo panel in the settings, the bucket CORS script.

## Technical context

| | |
|---|---|
| Storage | Neon object storage, bucket `files` on `main`, `dev`, `test` of `kete-account`; endpoint per branch from `GET …/branches/{id}/storage` |
| Credentials | `storage:read` + `storage:write`, anchored on the branch they serve (`kete-account-test` for tests and CI) |
| Images | sharp; JPEG, PNG, WebP in; WebP out, longest side 1024 px for a logo |
| Data | Migration `0001_files.sql`: `files` with its policy; `organization_settings.logo_file_id` with a composite same-organization foreign key |

## Constitution Check

| Principle | Status |
|---|---|
| I. Simple and working | Pass — one purpose (the logo), images only, no job runner yet |
| III. No vendor in the domain | Pass — business code sees `ObjectStorage`; the provider lives in `s3Storage` and env |
| V. Isolation in the creating migration | Pass — `files` created with `files_isolation`; composite FK for the logo |
| VI. Bilingual | Pass — panel and errors in both catalogs |
| VIII. Nothing claimed without proof | Pass — tests on the real database and storage; Neon's gaps measured, not assumed |

## Findings that shaped the design

- A presigned PUT on Neon object storage does not bind the declared content type: the server
  always reads the bytes before deciding.
- `response-content-disposition` is ignored on presigned GETs: the port does not offer a download
  name rather than pretend.
- Storage round trips plus re-encoding took about 6 seconds in local runs against Frankfurt; the
  panel shows its progress, tests wait up to 30 s.
