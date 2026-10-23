---
'@kete-africa/sdk': minor
'@kete-africa/metrics': minor
'@kete-africa/capabilities': minor
---

The Measure (spec 144; doctrine D-062, R2, R7, R17; ADR 0015): a data set carries the center's four
axes (`dataset.v1`'s `axes`) and answers a question at home — `POST /datasets/{name}/query`
(`dataset-query.v1` → `dataset-answer.v1`), summed up by `@kete/metrics`' `answerQuery`;
`queryDataset` puts it with the reader's token. A figure whose app does not answer is `missing`,
never zero; figures gain the unit axis.
