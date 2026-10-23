# @kete-africa/metering

## 0.1.8

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.1.7

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.1.6

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.1.5

### Patch Changes

- Published again on the current versions of the packages it depends on.

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

- Metering (spec 120; phase 11, step B1): meters declared once (`defineMeters`, `keteMeters`);
  what was consumed recorded as known or estimated, a source's silence as unavailable — kept once
  per key, append-only, with its RLS policy; `consumption` by meter and by subject, each total
  with its certainty and its gaps.
