# @kete-africa/settings

## 0.1.0

### Minor Changes

- Settings in layers (spec 115; decision 0013; doctrine D-060): each setting declared once by its
  owner with its schema, default, layers, permission and words, a secret refused; resolved from
  Kete's default through the organization, the app, the legal entity or unit and the person to the
  device, each value with the layer it comes from; the app's and the entities' layers kept in the
  product (`kete_settings`, with its RLS policy) with an append-only journal; the Compte Kete's two
  layers read with the person's token, kept five minutes per token's hash.
