---
'@kete-africa/files': minor
'@kete-africa/ai': minor
---

`readDocument` reads Excel (sheet by sheet), PowerPoint (slide by slide), OpenDocument and RTF
through officeparser, and gives scans (an image, a PDF without text) to a `transcribe` port.
`@kete/ai`'s `scanReader(model)` is that port: a multimodal model reads the scan page by page,
metered.
