---
'@kete-africa/infrastructure': minor
---

Updates and backups through the provisioning port (spec 131): `updateInstances` pushes a version to instances one after the other and puts the previous one back on any that does not answer; `backupInstance` and `restoreInstance`; the hosting port pins a version and follows a deployment (`version`, `pin`, `deployment`, `restart`; `deploy` returns the deployment's id); the databases port backs up and restores (`backup`, `backups`, `restore`), on Neon with `branchPerDatabase`.
