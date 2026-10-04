# Spec 053 — Files and final documents

## Why

A company works with its own documents: it reads them (procedures, reports, quotes) and produces
them (letters, quotes, reports) with its own layout and logo. An assistant of this era fills the
company's template instead of inventing a layout, and gives a PDF ready to send. All of it with
existing tools: unpdf and mammoth to read, docxtemplater to fill Word templates, Gotenberg to turn
Word, HTML or Markdown into PDF.

```mermaid
sequenceDiagram
  participant P as Product
  participant F as @kete/files
  participant G as Gotenberg
  P->>F: readDocument(pdf) — text page by page
  P->>F: templateFields(template) — what the template asks for
  P->>F: fillTemplate(template, values) — the final .docx
  P->>F: PdfConverter.fromWord(docx)
  F->>G: /forms/libreoffice/convert
  G-->>P: the PDF
```

## Requirements

- **FR-001**: `readDocument` reads PDF (page by page), Word, text, CSV, Markdown, JSON; `readable`.
- **FR-002**: `templateFields` lists a template's fields; `fillTemplate` fills it, a missing value
  empty; `TemplateError` for a file that is not a template.
- **FR-003**: `PdfConverter` port; `gotenbergConverter` (Word, HTML, Markdown); `pdfConverterFromEnv`
  (`KETE_GOTENBERG_URL`), null without it.
