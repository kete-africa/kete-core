# @kete-africa/notify

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
