# @kete-africa/views

## 0.2.0

### Minor Changes

- 77cfb71: The integration contract (spec 045): `dataset.v1` and the manifest's `datasets` and `endpoints`;
  `defineDataset`, `createDatasetRegistry` and `createHttpApi` serve an app's capabilities and data
  sets over HTTP under the caller's rights; `exposeRecord` turns a record type into `{type}_list` and
  `{type}_get`. A new app's template exposes its tasks, mounts its API at `/api/v1` and declares
  everything in its manifest.

## 0.1.1

### Patch Changes

- Follows the new versions of `@kete-africa/commands` and `@kete-africa/sdk`: a package pins the
  exact versions of its `@kete-africa` dependencies when it is published, so an app never gets two
  copies of the command journal.

## 0.1.0

### Minor Changes

- dc09e1d: Views in copilots (MCP Apps, doctrine D-037). `capability.v1` names a capability's view; the MCP
  handler serves views as `ui://` resources, names each tool's view, and lets the person decide a
  draft in the view (`kete_draft_review`, `kete_draft_validate`, `kete_draft_refuse`, visible to the
  view only), level 4 staying in the product's screen; `registry.review` and `registry.decide`;
  protected resource metadata (RFC 9728). New package `@kete/views`: the generic views (draft review,
  form, table, detail) as one self-contained page. A new actor channel, `view`. `@kete/design`
  exports `base.css`, its styles without font files.
