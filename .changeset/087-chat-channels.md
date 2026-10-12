---
'@kete-africa/notify': minor
---

The chat channels are delivered whole: `whatsAppChannel` and `telegramChannel` (text with
buttons, lists, documents, approved templates, files fetched), `receiveWhatsApp` and
`receiveTelegram` (the webhook, authenticated, as `ChatInbound` messages), `ChatChannelError` with
its reasons, and `memoryChatChannel` for tests. A sender now carries the provider's business-scoped
id, and a phone number only when the provider gives it. The port's two existing gestures are
unchanged; the new ones are optional.
