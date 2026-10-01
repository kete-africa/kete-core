---
'@kete-africa/views': minor
'@kete-africa/capabilities': minor
'@kete-africa/commands': minor
'@kete-africa/sdk': minor
'@kete-africa/design': minor
---

Views in copilots (MCP Apps, doctrine D-037). `capability.v1` names a capability's view; the MCP
handler serves views as `ui://` resources, names each tool's view, and lets the person decide a
draft in the view (`kete_draft_review`, `kete_draft_validate`, `kete_draft_refuse`, visible to the
view only), level 4 staying in the product's screen; `registry.review` and `registry.decide`;
protected resource metadata (RFC 9728). New package `@kete/views`: the generic views (draft review,
form, table, detail) as one self-contained page. A new actor channel, `view`. `@kete/design`
exports `base.css`, its styles without font files.
