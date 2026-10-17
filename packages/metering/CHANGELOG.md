# @kete-africa/metering

## 0.1.0

### Minor Changes

- Metering (spec 120; phase 11, step B1): meters declared once (`defineMeters`, `keteMeters`);
  what was consumed recorded as known or estimated, a source's silence as unavailable — kept once
  per key, append-only, with its RLS policy; `consumption` by meter and by subject, each total
  with its certainty and its gaps.
