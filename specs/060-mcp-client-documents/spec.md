# Spec 060 — MCP clients identified by their metadata document

## Why

The MCP revision of 2026-07-28 deprecates dynamic client registration for **Client ID Metadata
Documents** (CIMD): an MCP client's `client_id` is the HTTPS address of a document that describes
it. Until now the Compte Kete accepted only clients an operator registered, so Claude or ChatGPT
could not reach a Kete MCP endpoint (Kete Enterprise's gateway, an app's `/mcp`) without a manual
step. With CIMD, a person connects her client herself, and still signs in and consents.

```mermaid
sequenceDiagram
  participant C as MCP client (Claude)
  participant K as Compte Kete (@kete/identity)
  participant D as Client's host
  participant P as Person
  C->>K: /oauth2/authorize?client_id=https://claude.ai/oauth/client.json
  K->>D: GET the metadata document (resolved once, no private address, no redirect)
  D-->>K: client_name, redirect_uris
  K->>K: checked by the MCP profile; kept with provenance "cimd"
  K-->>P: sign in, consent to « Claude »
  P-->>K: yes
  K-->>C: code → token for the MCP server (RFC 8707 resource)
```

## Requirements

- **FR-001**: `@kete/identity` composes Better Auth's `cimd` plugin with its OpenID provider, MCP
  profile `mcp-2026-07-28`, on by default; `clientMetadataDocuments: false` turns it off,
  `allow(url)` limits the hosts, `fetch` replaces the transport (tests).
- **FR-002**: the discovery metadata says `client_id_metadata_document_supported`.
- **FR-003**: a client known by its document goes through the same sign-in and consent as any
  client; it never takes over an operator's client, never gets `client_credentials`.
- **FR-004**: a document refused by the policy, or whose `client_id` is not its own address, is
  rejected.

## Proof

`apps/account/tests/mcp-clients.test.ts`.
