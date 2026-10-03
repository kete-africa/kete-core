---
'@kete-africa/sdk': minor
'@kete-africa/capabilities': minor
'@kete-africa/center': minor
'@kete-africa/create-app': patch
---

The app contract (spec 049): an app declares its permissions with their words and default roles,
the classification of its capabilities and data sets, the events it emits, the subjects it asks
decisions for and its client id. `@kete/center` reads a person's grants at Kete Enterprise;
`createRights` follows them once the organization manages the app's rights.
