# 0001 — Files: storage, retention and safety

- **Status**: accepted
- **Date**: 2026-09-28
- **Decided by**: the author ("D'accord")
- **Applies to**: `@kete/files` (roadmap phases 2 and 4)

## Decision

1. **Model.** Stored content (blob) is separate from the business file, its attachments to
   records, its derived renditions, its AI extractions and its share links. A file inherits the
   permissions of the record it is attached to.
2. **First storage adapter: Cloudflare R2** (S3-compatible, no egress fees), behind a storage port.
   Self-hosted Garage remains a drop-in alternative.
3. **Safety before availability.** A file is never served until it is available: detected type and
   size checked; **PDFs and documents scanned by an antivirus** (ClamAV adapter first); **photos
   re-encoded**, which removes hidden content, and their location metadata stripped by default. A
   missing or failing scanner blocks availability.
4. **Retention by purpose** (defaults, adjustable per organization within legal limits):

   | Purpose | Retention |
   |---|---|
   | Data export | 7 days |
   | Draft source (photo, voice note) | 90 days after validation |
   | Deposit or job photos | While the record is active, then 1 year |
   | Invoices and accounting documents | 10 years (OHADA; to confirm with the accountant) |
   | Organization identity (logo) | While the organization exists |

   Purging destroys the content and keeps a minimal trace (who, what, when). A GDPR erasure request
   purges personal files immediately.
5. **Validated legal documents are immutable.** A correction creates a new version; the content
   hash is journaled.

## Why

Files are business documents, evidence, and AI sources at once; separating content from meaning
keeps permissions, retention and provenance correct. Direct uploads to storage suit low-bandwidth
phones.

## What would reverse it

A storage cost or data-residency requirement that R2 cannot meet (then Garage on Kete's servers);
a legal retention rule different from the defaults above.
