# 0003 — Identity tables are global; business tables are isolated per organization

- **Status**: accepted
- **Date**: 2026-09-28
- **Applies to**: `apps/account` (Compte Kete)

## Decision

The Better Auth tables (`user`, `session`, `account`, `verification`, `organization`, `member`,
`invitation`, `jwks`) are **global by nature**: signing in looks a person up by e-mail across
organizations, and a person can belong to several organizations. They carry no RLS policy; they are
reachable only by the Compte Kete service's application role, and no other service reads this
database (constitution VII).

Every table holding **organization data** (starting with `organization_settings`) carries its
organization and is created with its RLS policy in the same migration (constitution V). The service
sets `kete.organization_id` on each transaction, after checking the person's membership.

## Why

Forcing organization-scoped RLS on identity tables would break sign-in and invitations, or require
bypass roles — a weaker design than a strict service boundary.

## What would reverse it

A second service needing direct access to identity data (it must go through the Compte Kete
instead), or a regulatory requirement to partition identities per organization.
