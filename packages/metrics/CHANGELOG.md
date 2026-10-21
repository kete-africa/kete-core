# @kete-africa/metrics

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

- Figures and boards (spec 103, step L5). `@kete-africa/sdk` adds the contract `metric-reading.v1`
  (`validateMetricReading`). `@kete-africa/metrics` computes an app's declared figures within the
  reader's rights, over a period compared with the one before, serves them at `/api/metrics` and
  reads another app's (`/server`); screens get periods and `trend`. `@kete-africa/boards` keeps a
  board's cards in places, runs its routine, freezes it as a summary, says what changed and makes it a
  document to index by choice. `@kete-africa/design` adds `KpiTile`'s `trend`, `BoardGrid` and
  `SummaryCard`. A generated app declares `tasks.open` and `tasks.overdue` and serves `/api/metrics`.
