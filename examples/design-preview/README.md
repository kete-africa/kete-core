# Design preview

The two designs of `@kete/design` and a fictitious client brand, side by side, in both modes
(spec 027): what a reviewer looks at before a design change is merged.

```bash
pnpm --filter @kete/design-preview dev
```

Then open <http://localhost:3300>, or a single frame: `?frame=kete-light`, `kete-dark`,
`workspace-light`, `workspace-dark`, `brand-light`, `brand-dark`. Check each at 375 px too.

The words are literal: this is a preview, not an app, so it has no translation catalogs.
