# Contracts

The source of truth for every exchange between Kete services. TypeScript types in
`packages/sdk/src/contracts/` are generated from these files (`pnpm contracts:generate`); CI fails
if the generated code no longer matches (`pnpm contracts:check`).

| File                              | Contract                                                         |
| --------------------------------- | ---------------------------------------------------------------- |
| `event.v1.schema.json`            | The integration event envelope                                   |
| `event-data.v1.schema.json`       | The `data` of each standard event type                           |
| `delivery-request.v1.schema.json` | A signed batch of events sent to a receiver                      |
| `delivery-result.v1.schema.json`  | The receiver's outcome for each event                            |
| `manifest.v1.schema.json`         | An app's self-description (`kete.json`, `GET /.well-known/kete`) |
| `health.v1.schema.json`           | An app's health report (`GET /health`)                           |
| `capability.v1.schema.json`       | What an app exposes to agents, with its autonomy level (1 to 4)  |

Signature headers (outside the JSON body): `Kete-Product: <product id>` and
`Kete-Signature: t=<unix seconds>,kid=<key id>,v1=<hex HMAC-SHA256 of "{t}.{raw body}">`.

## Versioning rules

- Within a major version, changes are **additive only**: a new optional field, a new standard
  event type, a new refusal reason.
- Removing, renaming or restricting a field requires a **new major version** (`event.v2`), in a new
  file.
- During a transition, receivers accept the previous major version until every emitter has moved.
