# @kete-africa/design

## 0.6.0

### Minor Changes

- The shell of Kete 2026: a command palette (Ctrl K) on cmdk — search, ask and act from one field —
  with its trigger in the toolbar; a phone's bar of tabs with a raised « ask » action; counts of
  what waits beside the sidebar's items; links to another app marked and opened in a new tab; new
  icons (home, sparkle, people, folder, layers, flag, external, menu, clock).

## 0.5.0

### Minor Changes

- 203aa3a: Icons for the chat (spec 027): `attach`, `mic`, `file`.

## 0.4.0

### Minor Changes

- 7df2401: Forms in their place and every mode (spec 044): `Drawer` opens on the right when the screen is
  wide and centered otherwise; `FormPage` and `FormSection` give a long form its own page;
  `ThemeChoice` and `themeFromCookies`, `themeCookie`, `applyTheme` let a person choose dark, light
  or automatic, rendered by the server. A new app's template offers the choice and trusts Kete's own
  packages as soon as they are published.

## 0.3.0

### Minor Changes

- 79993e1: The page slots of an enterprise app (spec 040): `PageHeader`, `Tabs`, `CommandBar`,
  `ViewSwitcher`, `DataTable`, `Drawer`, `SplitView`, `DetailPane`, `Facts`, `KpiTile`, `KpiGrid`,
  `RowList`, `OrgChart`, and a chat kit to the usual standards (`ChatThread`, `ChatMessage`,
  `ToolCard`, `Composer`, `Suggestions`, `CopyButton`, a safe `Markdown`). A new app's template now
  serves its stylesheet from a container: `--static ../client`, and Tailwind never scans `dist/`.

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
