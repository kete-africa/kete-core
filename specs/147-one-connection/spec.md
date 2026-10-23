# Spec 147 — One connection, three uses

Doctrine D-062 (R8): an external tool is connected once and serves to read, act and signal — three
distinct permissions on the connection; act is never granted by default. ADR 0019 decides the
grants, the adapters and a webhook per connection onto the event path.

## Requirements

- **FR-001 — Three grants.** `ConnectionGrants`: read (given at connection), act (tool by tool, at
  a level 1 to 3 — never alone), signal (the tools watched). `allows` answers per use and tool;
  `grantsOf` reads kept grants and grants nothing it does not understand.
- **FR-002 — A signed webhook.** A secret per connection; `verifyWebhook` checks the HMAC-SHA256 of
  the exact body in constant time.

## Proof

`@kete/connections` tests: read at connection and nothing else; act tool by tool, a level 4 kept
by mistake refused; signal by choice; nonsense grants nothing; a webhook accepted with its
signature, refused with another body, another secret or none.

Kete Enterprise (its spec 105) shows each connection once with its three uses and health, keeps the
grants of its imported tool sets, and receives the webhooks onto the event path.
