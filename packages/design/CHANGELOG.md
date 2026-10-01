# @kete-africa/design

## 0.2.0

### Minor Changes

- 56aadff: The template of a Kete App (phase 5, spec 029). New packages: `@kete/jobs` (background jobs on
  Postgres with pg-boss: queued e-mails, the event relay), `@kete/admin` (Kete operators, operator
  gestures as journaled commands, the audit and its screen), `@kete/feedback` (the feedback button and
  its RLS table), `@kete/create-app` (`pnpm create @kete-africa/app`). `@kete/design/generate` lets an
  app generate its own design (D-038) with the same contrast checks. `@kete/testing`'s global setup
  starts one container even when declared twice.
- 2599b6c: Two designs in three layers (doctrine D-035): `kete` and `workspace` (the copilot-demo workspace's
  system, dark first), each with its DESIGN.md (base tokens, also as W3C Design Tokens), semantic tokens for both modes with their contrasts checked,
  components that use semantic tokens only — the doctrine's (verification card, agent states,
  confirmation, notification with undo, empty page) and the workspace's (frame, page, app grid,
  filters, menus, search, dialog) — and client brands,
  refused when their contrasts fail. `DESIGN.md` moves to `designs/kete/DESIGN.md` (the
  `@kete/design/DESIGN.md` export still points to it).
- dc09e1d: Views in copilots (MCP Apps, doctrine D-037). `capability.v1` names a capability's view; the MCP
  handler serves views as `ui://` resources, names each tool's view, and lets the person decide a
  draft in the view (`kete_draft_review`, `kete_draft_validate`, `kete_draft_refuse`, visible to the
  view only), level 4 staying in the product's screen; `registry.review` and `registry.decide`;
  protected resource metadata (RFC 9728). New package `@kete/views`: the generic views (draft review,
  form, table, detail) as one self-contained page. A new actor channel, `view`. `@kete/design`
  exports `base.css`, its styles without font files.
