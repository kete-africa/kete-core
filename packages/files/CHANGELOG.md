# @kete-africa/files

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
