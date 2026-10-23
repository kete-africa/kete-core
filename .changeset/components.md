---
'@kete-africa/sdk': minor
'@kete-africa/views': minor
---

Components configured where they are used (spec 145; doctrine D-062, R22; ADR 0016): the `view.v1`
contract (`validateView`); `@kete/views/figures` — the charts' options built by pure functions
(bar, line, pie, combined, cumulative, waterfall, Pareto, radar, box plot), the bullet's geometry,
the layers of a configuration (`resolveView`, `checkView`, `boundFilter`); `@kete/views/react` —
`EChart`, `Bullet`, `TileMap`, the common states and the provenance.
