---
'@kete-africa/create-app': patch
---

A new app reads kete-core's packages the way the Cockpit's move proved: the token never in a
committed `.npmrc` (user configuration, CI's `KETE_PACKAGES_TOKEN`, the image's build secret), its
approved build scripts in `pnpm-workspace.yaml`, a `.dockerignore`.
