# @kete-africa/auth

## 0.3.0

### Minor Changes

- bead1c9: The app contract, part 2 (spec 049): an app's own token for its center (`createAppToken`,
  `createAppTokenVerifier`, scope `kete:center`); named outboxes and a token transport, so business
  events reach the center without a shared key; the directory in `@kete/center`; the template
  announces `task.created` and `task.completed`.
- ad3a75c: The app contract, part 3 (spec 049): an agent's mandate. The Compte Kete exchanges a person's
  token for one an agent of the center carries (`POST /api/apps/mandates`, scope `kete:mandate`);
  `@kete/auth` reads `actingAgent` and gives the center `createMandates`; the template makes the
  caller the agent, for the person.

## 0.2.0

### Minor Changes

- e73b8bc: Copilots can sign in to a Kete MCP server (spec 038): `createTokenVerifier` accepts several
  audiences, so an MCP server accepts tokens bound to its own address (RFC 8707); `createIdentity`
  takes `resources`, the MCP servers its tokens may be issued for beyond `urn:kete:apps`.

## 0.2.0

### Minor Changes

- e73b8bc: Copilots can sign in to a Kete MCP server (spec 038): `createTokenVerifier` accepts several
  audiences, so an MCP server accepts tokens bound to its own address (RFC 8707); `createIdentity`
  takes `resources`, the MCP servers its tokens may be issued for beyond `urn:kete:apps`.
