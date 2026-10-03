# Spec 045 — The integration contract: an app's data enters the system by itself

## Why

« A new app, once connected, must make its data reachable. » Until now each tool was written by
hand and an app had no standard read API: every new app had to be wired to Kete Enterprise, its
dashboards and its assistant. The contract makes it automatic.

## What an app gets from declaring its records

```mermaid
flowchart LR
  R[A record type<br/>exposeRecord] --> L[{type}_list · table view]
  R --> G[{type}_get · detail view]
  D[A data set<br/>defineDataset] --> API
  L & G & C[Its other capabilities] --> REG[(Capability registry<br/>rights · journal · autonomy)]
  REG --> MCP[/mcp · copilots, the central chat/]
  REG --> API[/api/v1 · other apps, dashboards/]
  REG & D --> CARD[/.well-known/kete<br/>capabilities · datasets · endpoints/]
  CARD --> E[Kete Enterprise's registry]
```

- **`exposeRecord`** (`@kete/views`): two level-1 capabilities, `{type}_list` (searchable, a
  table a copilot shows) and `{type}_get` (one record, field by field), under the record's read
  permission. The app supplies `list`, `get` and its columns (words from its catalog).
- **`defineDataset`** (`@kete/capabilities`): rows of one shape — its JSON Schema, the field that
  dates a row, its measures and dimensions — read under a permission, in the caller's
  organization (RLS).
- **`createHttpApi`** (`@kete/capabilities`): the same registry over HTTP —
  `GET /capabilities`, `POST /capabilities/{name}` (`Idempotency-Key`), `GET /datasets`,
  `GET /datasets/{name}?from&to&limit`. A refusal comes back with its status (401 with the
  resource metadata, 403, 404, 422); a draft with 202.
- **The manifest** (`dataset.v1`, additive in `manifest.v1`): `capabilities`, `datasets`,
  `endpoints.mcp`, `endpoints.api`.

## Who calls the API

Another Kete app acting for the person whose token it holds: actor `{ kind: 'app', onBehalfOf:
person, channel: 'api' }`. It acts within her rights and only **prepares** a decision (level 3 and
4 give a draft she validates), as an agent does.

## The template

The example feature exposes its tasks (`task_list`, `task_get`, the `tasks` data set); the API is
mounted at `/api/v1`; the manifest declares everything. A new app gets all of it before its first
line of business code.

## Requirements

- **FR-001**: contracts are additive within `v1`; generated types match (`pnpm contracts:check`).
- **FR-002**: a data set never reaches beyond the caller's organization or rights; `limit` is at
  most 5 000 and an answer says when it was cut (`truncated`).
