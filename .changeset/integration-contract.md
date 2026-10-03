---
'@kete-africa/sdk': minor
'@kete-africa/capabilities': minor
'@kete-africa/views': minor
'@kete-africa/create-app': patch
---

The integration contract (spec 045): `dataset.v1` and the manifest's `datasets` and `endpoints`;
`defineDataset`, `createDatasetRegistry` and `createHttpApi` serve an app's capabilities and data
sets over HTTP under the caller's rights; `exposeRecord` turns a record type into `{type}_list` and
`{type}_get`. A new app's template exposes its tasks, mounts its API at `/api/v1` and declares
everything in its manifest.
