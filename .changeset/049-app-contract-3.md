---
'@kete-africa/auth': minor
'@kete-africa/create-app': patch
---

The app contract, part 3 (spec 049): an agent's mandate. The Compte Kete exchanges a person's
token for one an agent of the center carries (`POST /api/apps/mandates`, scope `kete:mandate`);
`@kete/auth` reads `actingAgent` and gives the center `createMandates`; the template makes the
caller the agent, for the person.
