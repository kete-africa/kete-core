# @kete-africa/identity

## 0.3.0

### Minor Changes

- 31653d6: MCP clients (Claude, ChatGPT, Codex) identify by their metadata document (Client ID Metadata
  Documents, MCP 2026-07-28) through Better Auth's `cimd` plugin: on by default, fetched safely, each
  person still consenting; `clientMetadataDocuments` limits the hosts or turns it off.

## 0.2.0

### Minor Changes

- e73b8bc: Copilots can sign in to a Kete MCP server (spec 038): `createTokenVerifier` accepts several
  audiences, so an MCP server accepts tokens bound to its own address (RFC 8707); `createIdentity`
  takes `resources`, the MCP servers its tokens may be issued for beyond `urn:kete:apps`.

## 0.1.0

### Minor Changes

- 82437c0: First release: the Compte Kete's rules on Better Auth, extracted so an instance that keeps its own
  identity reuses them — people, organizations and roles, passkeys, second factor, sign-in links, the
  OpenID provider, their Drizzle schema, and the OpenAPI description of their endpoints.
