---
'@kete-africa/connections': minor
---

One connection, three uses (spec 147; doctrine D-062, R8; ADR 0019): `ConnectionGrants` — read at
connection, act tool by tool at a level never above « prepare », signal by choice — with `allows`
and `grantsOf`; a webhook per connection signed with its own secret (`newWebhookSecret`,
`signWebhook`, `verifyWebhook`).
