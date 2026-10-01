---
'@kete-africa/commands': minor
---

The actor of a command can carry its chain of agents (doctrine D-039): `delegatedBy`, the agents
that asked, and `traceId`. A chain must go back to a person, name each agent once and stay within
`MAX_DELEGATION_DEPTH`. The journal keeps it and `readJournal` filters by trace. Existing apps add
`commandsDelegationMigrationSql` to their migrations.
