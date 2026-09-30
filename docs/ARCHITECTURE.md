# Architecture — Kete Core

Kete Core is the shared foundation of every Kete app: the contracts, the shared packages, and the
Compte Kete service with Mon espace Kete. What comes next follows the [roadmap](ROADMAP.md).

```mermaid
flowchart LR
    C[contracts/*.schema.json] -->|pnpm contracts:generate| T[packages/sdk/src/contracts<br/>types and schemas]
    T --> S[@kete/sdk]
    S --> A1[Kete apps<br/>outbox, relay, manifest, health]
    S --> K[Kete Cockpit<br/>receiver]
    A1 -->|signed batches| K
    D[packages/design/DESIGN.md] -->|pnpm design:generate| DS[@kete/design]
    DS --> ACC
    DS --> A1
    ACC[Compte Kete<br/>apps/account] -->|token + published keys| AU[@kete/auth]
    AU --> A1
```

## Principles applied

- **Contract first**: `contracts/` and `DESIGN.md` are sources of truth; generated code is checked
  in CI.
- **Generic first**: packages depend on ports (`SqlExecutor`, `Transport`, `DedupeStore`, the
  e-mail port); Postgres, HTTP and providers are adapters.
- **Security in the database**: organization data is created with its RLS policy; the services
  connect with roles that cannot bypass it; cross-organization work goes through `SECURITY DEFINER`
  functions. Identity tables of the Compte Kete are the one global exception
  ([decision 0003](decisions/0003-identity-tables-are-global.md)).
- **One account, verified locally**: apps never call the Compte Kete on each request; they verify
  its short-lived token against its published keys.

## Layout

| Path                     | Content                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `contracts/`             | Versioned JSON Schema contracts                                                               |
| `packages/sdk/`          | `@kete/sdk` — see its [README](../packages/sdk/README.md)                                     |
| `packages/design/`       | `@kete/design` — see its [README](../packages/design/README.md)                               |
| `packages/auth/`         | `@kete/auth` — see its [README](../packages/auth/README.md)                                   |
| `packages/payments/`     | `@kete/payments` — see its [README](../packages/payments/README.md)                           |
| `packages/files/`        | `@kete/files` — see its [README](../packages/files/README.md)                                 |
| `packages/tenancy/`      | `@kete/tenancy` — see its [README](../packages/tenancy/README.md)                             |
| `packages/testing/`      | `@kete/testing` — see its [README](../packages/testing/README.md)                             |
| `packages/commands/`     | `@kete/commands` — see its [README](../packages/commands/README.md)                           |
| `packages/records/`      | `@kete/records` — see its [README](../packages/records/README.md)                             |
| `packages/drafts/`       | `@kete/drafts` — see its [README](../packages/drafts/README.md)                               |
| `packages/capabilities/` | `@kete/capabilities` — see its [README](../packages/capabilities/README.md)                   |
| `packages/ai/`           | `@kete/ai` — see its [README](../packages/ai/README.md)                                       |
| `apps/cockpit/`          | Kete Cockpit — see its [README](../apps/cockpit/README.md)                                    |
| `apps/account/`          | Compte Kete and Mon espace Kete — see its [README](../apps/account/README.md)                 |
| `apps/docs/`             | The documentation site, built from this repository — see its [README](../apps/docs/README.md) |
| `tooling/`               | Shared TypeScript configuration, generation and checks                                        |
| `.changeset/`            | Pending package changes; versions and changelogs (decision 0006)                              |
| `specs/`                 | Spec Kit features                                                                             |
| `docs/`                  | This architecture, flows, decisions (MADR), roadmap                                           |

Releases, guards and documentation rely on recognized tools — Changesets, Renovate, gitleaks,
`pnpm audit`, Knip, Starlight with TypeDoc — ([decision 0006](decisions/0006-tooling-and-documentation.md)).
`pnpm docs:dev` and `pnpm docs:build` read and build the site.

Flows: [event delivery](flows/event-delivery.md) · sign-in, invitation and token: in the
[Compte Kete README](../apps/account/README.md) and the [`@kete/auth` README](../packages/auth/README.md).

## Databases

| Neon project   | Used by                                                 | Branches              |
| -------------- | ------------------------------------------------------- | --------------------- |
| `kete-core`    | `@kete/sdk` tests                                       | `main`, `dev`, `test` |
| `kete-cockpit` | Kete Cockpit (registry, health, events — decision 0004) | `main`, `dev`, `test` |
| `kete-account` | Compte Kete, with its object storage (bucket `files`)   | `main`, `dev`, `test` |

Each service owns its database; no service reads another's. Where services run and how they go
live: [operations](OPERATIONS.md).
