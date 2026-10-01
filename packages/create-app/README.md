# @kete/create-app

Creates a Kete App from kete-core's template (`templates/app`, spec 029):

```bash
pnpm create @kete-africa/app nettio --design=workspace
```

The new app is named, wears its design (`kete` by default, `workspace` for an enterprise), and takes
its `@kete/*` packages from GitHub Packages at their published versions — never a branch of
kete-core (doctrine D-034). It carries its context for agents (`CLAUDE.md`), its documentation, its
Dockerfile (web and worker) and its CI, and passes CI on its first commit.

```mermaid
flowchart LR
  T[templates/app] -->|prepack: template + versions.json| P[@kete-africa/create-app]
  P -->|createApp: rename, design, npm: aliases, .npmrc| A[the new app]
```
