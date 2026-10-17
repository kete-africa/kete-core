# @kete-africa/settings

## 0.2.0

### Minor Changes

- 5c5c341: Settings where a command runs (spec 117): the Compte Kete's client keeps an organization's layer by
  its id (`organization(id)`, five minutes) and `settingsHere` resolves inside the organization's
  transaction — the app's layer over the organization's, never a person's; a new app's commands read
  theirs with `settingsIn(db, organizationId)`.
- f251c61: « Réglages » (spec 116): `@kete/shell` draws the same settings page in every app from the
  declarations (`SettingsPanel`, `controlOf`, `sayValue`) — her preferences first, then the
  organization's, each value with where it comes from; a declaration says the words of its choices
  (`choices`); a new app has « Réglages » at the foot of its places, her preferences saved in the
  Compte Kete and the app's settings journaled under `settings:manage`.

## 0.1.0

### Minor Changes

- Settings in layers (spec 115; decision 0013; doctrine D-060): each setting declared once by its
  owner with its schema, default, layers, permission and words, a secret refused; resolved from
  Kete's default through the organization, the app, the legal entity or unit and the person to the
  device, each value with the layer it comes from; the app's and the entities' layers kept in the
  product (`kete_settings`, with its RLS policy) with an append-only journal; the Compte Kete's two
  layers read with the person's token, kept five minutes per token's hash.
