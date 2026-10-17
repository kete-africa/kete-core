---
status: accepted
date: 2026-10-17
decision-makers: the author (« Je valide, suis le plan et continue »), on the proposal discussed the same day; doctrine D-060
---

# 0013 — Settings in layers, declared once, the same in every app

## Context and Problem Statement

Applies to every Kete product: the Compte Kete, Kete Enterprise, the apps behind it and the Kete
Apps sold alone (Nettio, Firmo). Each read its language, currency and theme its own way: Kete
Finance from `FINANCE_CURRENCY`, Support from `SUPPORT_CURRENCY`, the theme from a cookie kept per
site, while the Compte Kete held an organization's generic settings (D-013) that no app read. A
person who chose the dark mode in one app found the light one in the next. Doctrine D-060 asks for
one settings concept present everywhere, like Kete Intelligence.

## Decision Drivers

- Generalize at the first known second use (D-059): every product needs the same settings.
- One source of truth per value; the screen says where a value comes from.
- Who may change a setting is a permission, and its changes are journaled (D-058).
- A secret is never a setting: it is sealed where secrets are kept.
- No new service: Postgres in each product, the Compte Kete for what follows a person.

## Considered Options

- Each product keeps its own settings, as today.
- A settings service of its own, read by every product.
- A module of the core (`@kete/settings`): declarations, resolution by layers, storage in each
  product's database, the Compte Kete holding the organization's and the person's layers.

## Decision Outcome

Chosen option: the module of the core, because it needs no new service, keeps each value where its
owner lives, and gives every product the same declaration, the same reading and the same screen.

- **A setting is declared once** by its owner (the core for `kete.*`, an app for its product's
  keys, in its manifest): key, schema, default, the layers where it may be set, the permission that
  changes it, its words in French and English, its group.
- **Six layers, the most precise wins**: Kete (the declared default), the organization, the app
  (for the whole organization), the legal entity or unit (a subsidiary, a site: more precise than
  the app), the person, the device. Resolution returns each value with the layer it
  comes from.
- **Where each layer lives**: the organization's and the person's in the Compte Kete (the person's
  preferences are global, like identity: decision 0003); the entity's and the app's in the product's
  own database (`kete_settings`, with its RLS, and its append-only journal `kete_setting_events`);
  the device's in a cookie — only a copy, so the page renders without a flash.
- **Apps read the Compte Kete's layers** with the person's token (`GET /api/apps/settings`), kept
  five minutes per token's hash, and save a person's preference there (`PUT`), so it follows her.
- **Secrets are refused** by the module: they go to the sealed secrets of the product.

### Consequences

- Good, because a new app declares its settings and gets its screen, its journal and the person's
  preferences for free; an agent reads the same values as the screen.
- Good, because the organization's generic settings of D-013 are finally read by every app.
- Bad, because every product must move its environment-variable settings to declarations, one by
  one.

### Confirmation

`@kete/settings` tests (resolution, refusals, journal, RLS); the Compte Kete's API tests; the
template reads its settings through the module; no app reads a business setting from an
environment variable once moved.

## More Information

Spec `specs/115-settings`. Doctrine D-013, D-058, D-059, D-060. What would reverse it: a setting
that must change faster than the five-minute cache allows, which would call for an event pushed
to the apps (`settings.changed`) — planned, not built here.
