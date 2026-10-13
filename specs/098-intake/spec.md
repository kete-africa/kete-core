# Spec 098 — Intake

Step **E4** of phase 8 (`docs/ROADMAP.md`): what a person receives — a message, a photo, a voice
note, a document — becomes a draft whose every field says where it comes from; she corrects it,
and her correction is kept.

## Why

A receipt photographed, a client's WhatsApp message, a delivery note: today someone retypes them.
A model can read them — but a value whose origin nobody can check is worse than a blank field:
the person signs what she has not seen. Each value must say what it was read from, how sure the
reading is, and the very passage it comes from; what the source does not say stays empty.

```mermaid
sequenceDiagram
  participant P as Person
  participant A as App
  participant M as Model (@kete/ai)
  participant D as Draft (@kete/drafts)
  P->>A: a photo of a receipt
  A->>M: intake(schema of the record, the photo)
  M-->>A: each field: found? value, passage, certainty
  A->>A: each value checked against its field; required ones missing → she types them
  A->>D: a draft, prepared by the reading agent for her, with each field's provenance
  P->>D: verifies — each field shows « tiré de la photo — « TOTAL 25 000 FCFA » »
  P->>D: corrects one, validates
  D-->>A: the record written; the correction kept as learning material
```

## What changes

- **`@kete/ai`: `intake({ model, schema, source, by, context?, evidence? })`** — `source` is a
  message, a voice note's transcript, a photo or a document. The model answers, for each field
  of the record's own zod schema, whether the source says it, its value, the passage it read it
  in, and how sure it is. Each value is checked against its field; a value the field refuses is
  read as nothing (the rest of the reading stands). It returns `values`, their `provenance` —
  `{ source, by, certainty, quote, evidence }` — and the required fields that are `missing`.
- **`@kete/drafts`**: a field's provenance may carry its `quote`, the passage it was read in.
- **The template** (`create-app`): `src/platform/intake.ts` — `readIntoDraft` reads what was
  received into a capability's draft, prepared by the reading agent (`agt_intake`) for the
  person, within her rights; incomplete readings come back with what is missing, nothing
  prepared. The tasks page reads a pasted message or a photo; the verification card shows, by
  each field, where it comes from and its passage.

## What stays for later

- Kete Finance's expense note from a receipt's photo, and Kete Commitments' contract read into its
  obligations and rules: each app adopts `intake` on its own records.
- A document of several pages: today one file is shown to the model as it is.
- The corrections kept are not yet used to improve the next reading.

## Proof

- `packages/ai/tests/intake.test.ts` (3): **a receipt's photo becomes values with the provenance
  of each field** — source, certainty, passage, evidence; an optional field not on the receipt
  is neither guessed nor missing; a value its field refuses (« hier » as a day) is left out and
  the required fields to type are said; a voice note says so.
- `templates/app/tests/intake.test.ts` (3): a photo becomes a task draft whose every field has
  its provenance, nothing written; the person corrects the title and validates, the task is
  written and her correction kept; an incomplete reading prepares nothing; without a model, it
  says it is not connected.
- Not proven: a real model reading a real receipt — the model is played in the tests.
