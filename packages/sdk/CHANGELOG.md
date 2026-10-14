# @kete-africa/sdk

## 0.8.1

### Patch Changes

- Kete Intelligence (spec 101): `@kete-africa/intelligence` streams a turn of the agents' runtime as the contract `intelligence-event.v1` and draws it in the drawer beside the page — status, plan, each capability with its level, the words as they come, drafts, sources, « Arrêter ». `@kete-africa/agents` says each capability as it starts (`calling`). The contract accepts a product's own addresses for a draft and a source. The template's page « Demander » becomes the drawer.

## 0.8.0

### Minor Changes

- The contracts of the canvas (spec 099): the manifest's question, places and metrics; dated facts; metrics; proposal sets; resources and lessons; file links; the stream of a Kete Intelligence turn — each validated and typed.

## 0.7.0

### Minor Changes

- The center's references and the facts of money: `@kete/center` reads third parties and projects
  with the person's token, opens a project from the app's own document, and says a fact of money in
  the shape of the new contract `money-fact.v1`, which `@kete/sdk` validates (`validateMoneyFact`).

## 0.6.0

### Minor Changes

- bead1c9: The app contract, part 2 (spec 049): an app's own token for its center (`createAppToken`,
  `createAppTokenVerifier`, scope `kete:center`); named outboxes and a token transport, so business
  events reach the center without a shared key; the directory in `@kete/center`; the template
  announces `task.created` and `task.completed`.

## 0.5.0

### Minor Changes

- aa87c98: The app contract (spec 049): an app declares its permissions with their words and default roles,
  the classification of its capabilities and data sets, the events it emits, the subjects it asks
  decisions for and its client id. `@kete/center` reads a person's grants at Kete Enterprise;
  `createRights` follows them once the organization manages the app's rights.

## 0.4.0

### Minor Changes

- 77cfb71: The integration contract (spec 045): `dataset.v1` and the manifest's `datasets` and `endpoints`;
  `defineDataset`, `createDatasetRegistry` and `createHttpApi` serve an app's capabilities and data
  sets over HTTP under the caller's rights; `exposeRecord` turns a record type into `{type}_list` and
  `{type}_get`. A new app's template exposes its tasks, mounts its API at `/api/v1` and declares
  everything in its manifest.

## 0.3.0

### Minor Changes

- 09f35ee: `manifest.v1` carries an app's identity card (doctrine D-040), optional and additive: `governance`
  with its owner, data categories, use of AI and criticality. `createApp` and
  `pnpm create @kete-africa/app` now require `--owner`, written into the new app's card.

## 0.2.0

### Minor Changes

- 69bd40a: The `capability.v1` contract: the `Capability` type and `validateCapability`; a manifest may now
  list its `capabilities` (optional, additive).
- dc09e1d: Views in copilots (MCP Apps, doctrine D-037). `capability.v1` names a capability's view; the MCP
  handler serves views as `ui://` resources, names each tool's view, and lets the person decide a
  draft in the view (`kete_draft_review`, `kete_draft_validate`, `kete_draft_refuse`, visible to the
  view only), level 4 staying in the product's screen; `registry.review` and `registry.decide`;
  protected resource metadata (RFC 9728). New package `@kete/views`: the generic views (draft review,
  form, table, detail) as one self-contained page. A new actor channel, `view`. `@kete/design`
  exports `base.css`, its styles without font files.
