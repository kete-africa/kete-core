---
'@kete-africa/jobs': minor
'@kete-africa/admin': minor
'@kete-africa/feedback': minor
'@kete-africa/create-app': minor
'@kete-africa/design': minor
'@kete-africa/testing': patch
---

The template of a Kete App (phase 5, spec 029). New packages: `@kete/jobs` (background jobs on
Postgres with pg-boss: queued e-mails, the event relay), `@kete/admin` (Kete operators, operator
gestures as journaled commands, the audit and its screen), `@kete/feedback` (the feedback button and
its RLS table), `@kete/create-app` (`pnpm create @kete-africa/app`). `@kete/design/generate` lets an
app generate its own design (D-038) with the same contrast checks. `@kete/testing`'s global setup
starts one container even when declared twice.
