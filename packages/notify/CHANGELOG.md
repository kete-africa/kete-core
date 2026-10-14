# @kete-africa/notify

## 0.5.0

### Minor Changes

- Proposals and voice (spec 104, step L6). `@kete-africa/drafts` keeps proposal sets — applied
  together by one gesture, a level 4 item waiting for its own confirmation, undone together
  (`proposeSet`, `applySet`, `dismissSet`, `undoSet`, `proposalSetsMigrationSql`). `@kete-africa/ai`
  understands a note as gestures on the objects the app knows (`understand`), never guessed.
  `@kete-africa/notify` gives a message's words, a voice note written by the dictation port
  (`wordsOf`). `@kete-africa/sdk`: a proposal's item carries its capability's `input` (additive).
  `@kete-africa/design` adds `ProposalList` and `VoiceCapture`. A generated app closes its day at
  `/soir`.

## 0.4.0

### Minor Changes

- b5d6c3f: The outbox to people (spec 088): `chatOutboxMigrationSql` and its four tables with their
  row-level security; a sender per organization with its credentials sealed (`connectChatSender`);
  contacts and their consent; the organization’s words per kind of message; `queueChatMessage`,
  `queueChatText`, `queueChatReply`, `deliverChat` with retries and the approved template;
  `receiveChat`, the webhook that finds its organization by the provider’s account and checks it
  with that organization’s own secret; statuses and cost category (`noteChatStatus`, `chatUsage`).
  The port may answer with a `ChatReceipt`; `parseWhatsAppStatuses` and `whatsAppAccountsOf` read a
  notification’s statuses and accounts.

## 0.3.0

### Minor Changes

- a12f82c: The chat channels are delivered whole: `whatsAppChannel` and `telegramChannel` (text with
  buttons, lists, documents, approved templates, files fetched), `receiveWhatsApp` and
  `receiveTelegram` (the webhook, authenticated, as `ChatInbound` messages), `ChatChannelError` with
  its reasons, and `memoryChatChannel` for tests. A sender now carries the provider's business-scoped
  id, and a phone number only when the provider gives it. The port's two existing gestures are
  unchanged; the new ones are optional.

## 0.2.0

### Minor Changes

- 3db5622: In-app notifications (read or not, with row-level security) and Web Push through `web-push` with
  VAPID keys, behind a port; devices the push service forgot are removed.

## 0.1.0

### Minor Changes

- f69d815: First release: e-mails rendered with React Email and sent through a port (MailKite first, a log
  sender without provider, a memory sender for tests), MailKite webhook verification, and the port of
  chat channels.
