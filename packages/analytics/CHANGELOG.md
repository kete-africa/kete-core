# @kete-africa/analytics

## 0.1.4

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.1.3

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.1.2

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.1.1

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.1.0

### Minor Changes

- Two new packages (spec 091): `@kete/log`, structured logs behind a port on pino, redacted and tied
  to their trace; `@kete/analytics`, usage per organization in Postgres, read by the organization, and
  by Kete Cockpit as daily `metrics.daily` counts with no person in them.
