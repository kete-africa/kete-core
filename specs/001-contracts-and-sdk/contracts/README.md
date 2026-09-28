# Contracts — 001

Draft contracts for this feature. On implementation they move to the repository's `contracts/`
directory, which is their source of truth; TypeScript types are generated from them.

| File | Contract |
|---|---|
| `event.v1.schema.json` | The integration event envelope. Per-type `data` schemas are listed in `../data-model.md`. |
| `delivery.v1.schema.json` | The batch request sent to a receiver and its per-event response. |
| `manifest.v1.schema.json` | An app's self-description (`kete.json`, `GET /.well-known/kete`). |
| `health.v1.schema.json` | An app's health report (`GET /health`). |

Signature headers (not part of the JSON body): `Kete-Product: <product id>` and
`Kete-Signature: t=<unix seconds>,kid=<key id>,v1=<hex HMAC-SHA256 of "{t}.{raw body}">`.
