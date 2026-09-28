# Architecture — Kete Core

Kete Core is the shared foundation of every Kete app. Today it contains the contracts and
`@kete/sdk`; the Compte Kete service, the design system and the other shared packages follow the
[roadmap](ROADMAP.md).

```mermaid
flowchart LR
    C[contracts/*.schema.json] -->|pnpm contracts:generate| T[packages/sdk/src/contracts<br/>types and schemas]
    T --> S[@kete/sdk]
    S --> A1[Kete apps<br/>outbox, relay, manifest, health]
    S --> K[Kete Cockpit<br/>receiver]
    A1 -->|signed batches| K
```

## Principles applied

- **Contract first**: `contracts/` is the source of truth; generated code is checked in CI.
- **Generic first**: the SDK depends on ports (`SqlExecutor`, `Transport`, `DedupeStore`); Postgres
  and HTTP are adapters.
- **Security in the database**: the outbox is created with its RLS policy; cross-organization work
  goes through `SECURITY DEFINER` functions.

## Layout

| Path            | Content                                                   |
| --------------- | --------------------------------------------------------- |
| `contracts/`    | Versioned JSON Schema contracts                           |
| `packages/sdk/` | `@kete/sdk` — see its [README](../packages/sdk/README.md) |
| `tooling/`      | Shared TypeScript configuration, code generation          |
| `specs/`        | Spec Kit features                                         |
| `docs/`         | This architecture, flows, decisions, roadmap              |

Flows: [event delivery](flows/event-delivery.md).
