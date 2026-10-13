# @kete/create-app

Creates a Kete App from kete-core's template (`templates/app`, spec 029):

```bash
pnpm create @kete-africa/app nettio --owner="Software team" --contact=software@example.com --design=workspace
```

pnpm takes a version only once it is older than its minimum release age: on the day the template
changes, `pnpm create` still gives the one before. To get today's, name it and lift the age for that
call — `pnpm --config.minimumReleaseAge=0 create @kete-africa/app@<version> …` (seen on 2026-10-13,
when Kete Gestion was born).

The new app is named, wears its design (`kete` by default, `workspace` for an enterprise), and takes
its `@kete/*` packages from GitHub Packages at their published versions — never a branch of
kete-core (doctrine D-034). Its manifest carries its identity card from the first commit
(doctrine D-040): `--owner` names the person or team that answers for it; its data categories, its
use of AI and its criticality start as the template's (`personal`, no AI, `low`) and are corrected
in `kete.json` as soon as they differ. It carries its context for agents (`CLAUDE.md`), its documentation, its
Dockerfile (web and worker) and its CI, and passes CI on its first commit.

```mermaid
flowchart LR
  T[templates/app] -->|prepack: template + versions.json| P[@kete-africa/create-app]
  P -->|createApp: rename, design, npm: aliases, .npmrc| A[the new app]
```
