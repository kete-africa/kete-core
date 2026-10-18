# @kete-africa/auth

## 0.5.1

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.5.0

### Minor Changes

- The template, born complete (spec 093): business roles (`businessRoles`, `businessRoleOf`,
  `businessRolesMigrationSql`) and `performGesture` with `RuleError` in `@kete/capabilities`; form
  fields (`SelectField`, `CheckField`, `ChoiceField`, `TextAreaField`, `ErrorNote`, `InfoNote`) in
  `@kete/design`; `signSession` in `@kete/auth`; and a new app born with « Demander », WhatsApp and
  Telegram, usage, logs and the roles of its trade.

## 0.4.0

### Minor Changes

- Offers with limits (spec 092): the token carries `plans` — per app, the offer, whether it is a
  trial, the end of use, the end of reading and its limits. `@kete/auth` reads it (`planOf`,
  `limitOf`, `refusalOf`, `requireWithinPlan`, `mayRead`); `@kete/identity` fills it from
  `plansOf`. A token without it is read as before.

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
