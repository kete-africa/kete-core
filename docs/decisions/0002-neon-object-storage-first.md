# 0002 — Neon Object Storage is the first storage adapter

- **Status**: accepted — supersedes point 2 of [0001](0001-files-storage-retention-and-safety.md)
- **Date**: 2026-09-28
- **Decided by**: the author ("quand tu arriveras au stockage, on priorise Neon Storage")

## Decision

`@kete/files` uses **Neon Object Storage** as its first storage adapter, behind the storage port.
Cloudflare R2 and self-hosted Garage remain alternatives.

## Why

- **Buckets branch with the database** (copy-on-write): a preview branch gets its own files, like
  its data, with nothing to clean up by hand. This matches the delivery flow (doctrine `FLUX.md`).
- One provider for data and files; available in Frankfurt (`aws-eu-central-1`), next to the data.
- S3-compatible (path-style), with presigned GET and PUT, multipart uploads, private buckets and
  per-branch credentials, so the adapter stays a thin S3 client.

## What it costs

Neon Object Storage is recent; the port keeps a switch to R2 or Garage cheap. Object size limits
and pricing are to be measured on real usage.
