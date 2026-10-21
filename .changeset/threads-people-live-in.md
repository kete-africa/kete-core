---
'@kete-africa/sdk': minor
'@kete-africa/threads': minor
'@kete-africa/channels': minor
'@kete-africa/work': minor
'@kete-africa/time': minor
'@kete-africa/drafts': minor
'@kete-africa/policies': minor
'@kete-africa/center': minor
'@kete-africa/settings': minor
'@kete-africa/create-app': minor
---

Threads people live in (spec 139): `message.v1` says `visibility` and `moved_from`, `holding.v1` a `priority`, `snoozed_until` and a holding waited on; `@kete/threads` gives unread counts and marks, members and mentions, files with versions, moved messages and live changes (`threadsLiveMigrationSql`, `threadSummariesOf`, `listenThreads`, `changesSince`); `@kete/channels` answers on WhatsApp in its 24-hour window or by template (`answerByChat`); `@kete/work` priorities, snoozes and nudges by priority (`workPrioritiesMigrationSql`); `@kete/time` her days as an iCalendar feed (`icsFeed`); `@kete/drafts` a draft anyone can read (`describeDraft`); `@kete/policies` the six policies as templates and their simulation; `@kete/center` an app object's thread (`openObjectThread`); settings for nudges, the threads' digest and WhatsApp's template.
