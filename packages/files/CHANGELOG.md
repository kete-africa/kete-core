# @kete-africa/files

## 0.5.0

### Minor Changes

- d2509b9: Threads for everyone (spec 140; doctrine D-061).

  - **`message.v1`** gains `references` (the objects cited with « # »), `only_for` (one reader), and a
    voice note's `duration_ms` and `transcript`.
  - **`holding.v1`** gains `delegate` and `return_to`.
  - **`@kete/threads`** (`threadsComfortMigrationSql`) adds:
    - reactions, pins, and a message taken back (kept in the proof);
    - transcripts that are searched;
    - citations with « Cité dans », threads attached to several objects, and pages of fifty;
    - a message only for one person, and its sharing;
    - notification levels with `whoToTell`, and typing announced;
    - `mediaOf`, files in the product's storage up to 100 MB, WhatsApp and Telegram imports kept
      once, and merged threads.
  - **`@kete/channels`** (`channelsMailRefsMigrationSql`):
    - a reply finds its thread by what it answers;
    - a mailbox is read folder by folder, with the product's rule, and a Sent folder's mail is the
      person's own;
    - a mail is cleaned of what it quotes and of its signature, with its original kept;
    - `fromEml` reads a mail file.
  - **`@kete/work`** (`workDelegatesMigrationSql`): a person holds, an agent is delegated, and the
    result returns.
  - **`@kete/files`**: `diskStorage`.
  - **`@kete/design`**: `MessageField` and `FieldToggle`, the one composer of the canvas v6.2, and the
    canvas v6.2's icons.
  - **`@kete/conversation`** (new): the threads' screen any product shows — `ConversationFrame`,
    `ThreadListPanel`, `ThreadHeader`, `PinBar`, `MessageStream`, `MessageItem`, `AgentRun` and
    `ThreadInfo`.
  - **`@kete/intelligence`**: its `Composer` is `MessageField`.

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
