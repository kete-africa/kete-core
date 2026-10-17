---
'@kete-africa/settings': minor
'@kete-africa/create-app': minor
---

Settings where a command runs (spec 117): the Compte Kete's client keeps an organization's layer by
its id (`organization(id)`, five minutes) and `settingsHere` resolves inside the organization's
transaction — the app's layer over the organization's, never a person's; a new app's commands read
theirs with `settingsIn(db, organizationId)`.
