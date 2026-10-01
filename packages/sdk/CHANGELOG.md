# @kete-africa/sdk

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
