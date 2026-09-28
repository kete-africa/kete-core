# Feature Specification: Files (core) and the organization logo

**Feature Branch**: `004-files`
**Created**: 2026-09-28
**Status**: Implemented
**Input**: Roadmap phase 2 — `@kete/files` core on Neon object storage (decisions 0001, 0002), and
the organization's logo in Mon espace Kete.

## User Scenarios & Testing

### User Story 1 — An organization gives itself a logo (P1)

An owner or an administrator sends an image from Mon espace Kete; it appears in the settings, and
every member of the organization sees it.

**Independent Test**: upload a PNG in the settings, see it displayed — in a browser.

**Acceptance Scenarios**:

1. **Given** an administrator, **When** they send a JPEG, PNG or WebP image of at most 5 MB,
   **Then** it becomes the organization's logo.
2. **Given** a logo in place, **When** a new one is sent, **Then** it replaces it and the previous
   content is destroyed.
3. **Given** a logo, **When** the administrator removes it, **Then** it is no longer shown.
4. **Given** a member, **Then** they see the logo but cannot change it.

### User Story 2 — Nothing unsafe is ever served (P1)

**Acceptance Scenarios**:

1. **Given** a file that is not a real JPEG, PNG or WebP image (whatever its name or declared
   type), **Then** it is refused with a clear message and never becomes readable.
2. **Given** an accepted image, **Then** what is served is a re-encoded copy without location,
   camera or comment metadata.
3. **Given** a file over 5 MB, or an image with too many pixels, **Then** it is refused.

### User Story 3 — Organizations never see each other's files (P1)

**Acceptance Scenarios**:

1. **Given** two organizations, **Then** neither can list, read, complete or reference the
   other's files — in the database and in the service.

### Edge Cases

- The browser never sends the file after asking for an address: the pending row stays; its
  upload address expires after 10 minutes (clean-up of stale pending rows comes with a job
  runner).
- The completion is called twice: the first decides, the second changes nothing.

## Requirements

- **FR-001**: A storage port with an S3-compatible adapter and an in-memory adapter.
- **FR-002**: Direct browser uploads and reads through short-lived presigned addresses; buckets
  stay private.
- **FR-003**: Content is judged by its bytes; images are re-encoded without metadata before
  becoming available (decision 0001, point 3).
- **FR-004**: Files are rows under RLS, created with their policy in the same migration; a logo
  can only point at a file of the same organization (enforced by the database).
- **FR-005**: The logo panel in Mon espace Kete, in French and English, usable at 375 px.

## Success Criteria

- **SC-001**: The cross-organization test passes on the database and the storage.
- **SC-002**: 100% of disguised or oversized files in the test set are refused and never served.
- **SC-003**: No metadata of the original survives in a served image.

## Assumptions

- Only images for now; documents (PDF) wait for an antivirus adapter (decision 0001).
- One bucket per Neon branch, named `files`; credentials anchored on each branch.
