# @kete-africa/metrics

## 0.2.1

### Patch Changes

- 480d724: Components configured where they are used (spec 145; doctrine D-062, R22; ADR 0016): the `view.v1`
  contract (`validateView`); `@kete/views/figures` — the charts' options built by pure functions
  (bar, line, pie, combined, cumulative, waterfall, Pareto, radar, box plot), the bullet's geometry,
  the layers of a configuration (`resolveView`, `checkView`, `boundFilter`); `@kete/views/react` —
  `EChart`, `Bullet`, `TileMap`, the common states and the provenance. A data set's field is named as
  the data set names it — a spreadsheet's header « Délai (jours) » included (`dataset-query.v1`).

## 0.2.0

### Minor Changes

- ebeab13: The Measure (spec 144; doctrine D-062, R2, R7, R17; ADR 0015): a data set carries the center's four
  axes (`dataset.v1`'s `axes`) and answers a question at home — `POST /datasets/{name}/query`
  (`dataset-query.v1` → `dataset-answer.v1`), summed up by `@kete/metrics`' `answerQuery`;
  `queryDataset` puts it with the reader's token. A figure whose app does not answer is `missing`,
  never zero; figures gain the unit axis.

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

- Figures and boards (spec 103, step L5). `@kete-africa/sdk` adds the contract `metric-reading.v1`
  (`validateMetricReading`). `@kete-africa/metrics` computes an app's declared figures within the
  reader's rights, over a period compared with the one before, serves them at `/api/metrics` and
  reads another app's (`/server`); screens get periods and `trend`. `@kete-africa/boards` keeps a
  board's cards in places, runs its routine, freezes it as a summary, says what changed and makes it a
  document to index by choice. `@kete-africa/design` adds `KpiTile`'s `trend`, `BoardGrid` and
  `SummaryCard`. A generated app declares `tasks.open` and `tasks.overdue` and serves `/api/metrics`.
