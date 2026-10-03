# @kete-africa/create-app

## 0.2.2

### Patch Changes

- 7df2401: Forms in their place and every mode (spec 044): `Drawer` opens on the right when the screen is
  wide and centered otherwise; `FormPage` and `FormSection` give a long form its own page;
  `ThemeChoice` and `themeFromCookies`, `themeCookie`, `applyTheme` let a person choose dark, light
  or automatic, rendered by the server. A new app's template offers the choice and trusts Kete's own
  packages as soon as they are published.
- 77cfb71: The integration contract (spec 045): `dataset.v1` and the manifest's `datasets` and `endpoints`;
  `defineDataset`, `createDatasetRegistry` and `createHttpApi` serve an app's capabilities and data
  sets over HTTP under the caller's rights; `exposeRecord` turns a record type into `{type}_list` and
  `{type}_get`. A new app's template exposes its tasks, mounts its API at `/api/v1` and declares
  everything in its manifest.

## 0.2.1

### Patch Changes

- 79993e1: The page slots of an enterprise app (spec 040): `PageHeader`, `Tabs`, `CommandBar`,
  `ViewSwitcher`, `DataTable`, `Drawer`, `SplitView`, `DetailPane`, `Facts`, `KpiTile`, `KpiGrid`,
  `RowList`, `OrgChart`, and a chat kit to the usual standards (`ChatThread`, `ChatMessage`,
  `ToolCard`, `Composer`, `Suggestions`, `CopyButton`, a safe `Markdown`). A new app's template now
  serves its stylesheet from a container: `--static ../client`, and Tailwind never scans `dist/`.

## 0.2.0

### Minor Changes

- 09f35ee: `manifest.v1` carries an app's identity card (doctrine D-040), optional and additive: `governance`
  with its owner, data categories, use of AI and criticality. `createApp` and
  `pnpm create @kete-africa/app` now require `--owner`, written into the new app's card.

### Patch Changes

- a875218: A new app reads kete-core's packages the way the Cockpit's move proved: the token never in a
  committed `.npmrc` (user configuration, CI's `KETE_PACKAGES_TOKEN`, the image's build secret), its
  approved build scripts in `pnpm-workspace.yaml`, a `.dockerignore`.

## 0.1.0

### Minor Changes

- 56aadff: The template of a Kete App (phase 5, spec 029). New packages: `@kete/jobs` (background jobs on
  Postgres with pg-boss: queued e-mails, the event relay), `@kete/admin` (Kete operators, operator
  gestures as journaled commands, the audit and its screen), `@kete/feedback` (the feedback button and
  its RLS table), `@kete/create-app` (`pnpm create @kete-africa/app`). `@kete/design/generate` lets an
  app generate its own design (D-038) with the same contrast checks. `@kete/testing`'s global setup
  starts one container even when declared twice.
