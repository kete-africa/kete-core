---
'@kete-africa/tools': patch
'@kete-africa/agents': minor
---

Security review fixes (spec 134): `publicFetch` checks the address again when connecting (no DNS rebinding) and cuts a long body; once outside content is in a turn, the agent's computer waits for a person and `web_read` reads only an address that content gave (`outsideTurn`, `UNSEEN_ADDRESS`).
