# Spec 141 — A thread, in the app

An app's object has its thread at the center (spec 139). Today the app only links to it (« Fil du
ticket »): to read and answer, the person leaves the app. Doctrine D-061 wants the thread where the
work is — a ticket's thread beside the ticket, drawn the same everywhere by `@kete/conversation`.

## Requirements

- **FR-001 — Read.** `@kete/center`'s `thread(token, threadId)` reads a thread at the center as the
  person reads it: its last messages, the names they need, the first she had not read, whether older
  ones exist. Without a center, a token or her right to it: `null`, never an exception.
- **FR-002 — Say.** `sayInThread(token, threadId, { text, mentions? })` says something in it as her,
  internal and for information. It answers `{ ok, error }`: `not_connected`, `signed_out`,
  `invalid_input`, `unreachable`, or the center's own refusal.
- **FR-003 — Drawn the same.** A message has the shape `@kete/conversation` draws; the app passes it
  through.

## Proof

- Unit tests of the client against a fake center: read, said, refused, alone.
- Support (`kete-africa/kete-helpdesk`) shows a ticket's thread beside the ticket and answers in it.
