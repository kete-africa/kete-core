---
'@kete-africa/auth': minor
'@kete-africa/identity': minor
---

Copilots can sign in to a Kete MCP server (spec 038): `createTokenVerifier` accepts several
audiences, so an MCP server accepts tokens bound to its own address (RFC 8707); `createIdentity`
takes `resources`, the MCP servers its tokens may be issued for beyond `urn:kete:apps`.
