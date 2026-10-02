---
'@kete-africa/design': minor
'@kete-africa/create-app': patch
---

The page slots of an enterprise app (spec 040): `PageHeader`, `Tabs`, `CommandBar`,
`ViewSwitcher`, `DataTable`, `Drawer`, `SplitView`, `DetailPane`, `Facts`, `KpiTile`, `KpiGrid`,
`RowList`, `OrgChart`, and a chat kit to the usual standards (`ChatThread`, `ChatMessage`,
`ToolCard`, `Composer`, `Suggestions`, `CopyButton`, a safe `Markdown`). A new app's template now
serves its stylesheet from a container: `--static ../client`, and Tailwind never scans `dist/`.
