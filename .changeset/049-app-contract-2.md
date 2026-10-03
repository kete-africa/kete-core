---
'@kete-africa/auth': minor
'@kete-africa/sdk': minor
'@kete-africa/center': minor
'@kete-africa/create-app': patch
---

The app contract, part 2 (spec 049): an app's own token for its center (`createAppToken`,
`createAppTokenVerifier`, scope `kete:center`); named outboxes and a token transport, so business
events reach the center without a shared key; the directory in `@kete/center`; the template
announces `task.created` and `task.completed`.
