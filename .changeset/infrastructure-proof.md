---
'@kete-africa/infrastructure': patch
---

Proven on Kete's Neon and Coolify (spec 121): the Coolify adapter serves a host the port gives as
an `https://` address; the Neon adapter's destruction takes the application role's privileges
before dropping it (PostgreSQL 16), waits for Neon to apply the database's removal before the
owner's, and never connects to a database already gone.
