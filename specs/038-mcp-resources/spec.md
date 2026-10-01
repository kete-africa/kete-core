# Feature Specification: Copilots sign in to an MCP server with the Compte Kete

**Feature Branch**: `038-mcp-resources`
**Created**: 2026-10-01
**Status**: In progress
**Input**: The author connecting Claude to Kete Enterprise's gateway (`kete-enterprise` spec 006);
the MCP authorization specification (RFC 9728 metadata, RFC 8707 resource indicators).

## Why

An MCP client (Claude, ChatGPT) asks the identity for a token bound to the MCP server's own
address (`resource=https://…/mcp`). The Compte Kete only issued tokens for `urn:kete:apps`, so a
copilot could not sign in to a Kete MCP server.

## User Scenarios & Testing

1. **Given** an MCP server's address declared in the Compte Kete's configuration, **When** a copilot
   asks a token for it, **Then** the Compte Kete issues one whose audience is that address, with the
   Kete claims.
2. **Given** an MCP server, **Then** it accepts tokens for `urn:kete:apps` and for its own address,
   and refuses a token bound to another server.

## Requirements

- **FR-001**: `@kete/auth`: `createTokenVerifier` accepts several audiences.
- **FR-002**: `@kete/identity`: the `resources` option adds resources beyond `urn:kete:apps`.
- **FR-003**: the Compte Kete reads `ACCOUNT_OAUTH_RESOURCES` (https addresses, comma-separated).
- **FR-004**: the app template's MCP endpoint accepts its own address as audience and advertises the
  scopes a copilot asks for (`offline_access` included).

## Success Criteria

- **SC-001**: `@kete/auth`'s tests prove several audiences, and the refusal of another server's.
- **SC-002** `[blocking]`: on staging, Claude signs in to Kete Enterprise's gateway.
