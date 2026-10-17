# @kete-africa/files

## 0.4.1

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.4.0

### Minor Changes

- `readSheets` and `readTable`: a workbook (Excel, OpenDocument) or a CSV read as grids, then one sheet typed as a table — numbers in French or English notation, days, texts.

## 0.3.1

### Patch Changes

- `templateFields` reads a template's fields through docxtemplater's parser hook instead of its inspection module, which needs lodash without declaring it: a production install (pnpm, strict) failed to start.

## 0.3.0

### Minor Changes

- 016bcb3: `readDocument` reads Excel (sheet by sheet), PowerPoint (slide by slide), OpenDocument and RTF
  through officeparser, and gives scans (an image, a PDF without text) to a `transcribe` port.
  `@kete/ai`'s `scanReader(model)` is that port: a multimodal model reads the scan page by page,
  metered.

## 0.2.0

### Minor Changes

- 855baf9: Documents read page by page (unpdf, mammoth), final documents filled from Word templates
  (docxtemplater), and PDF through Gotenberg behind a port.
