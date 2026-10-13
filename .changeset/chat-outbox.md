---
'@kete-africa/notify': minor
---

The outbox to people (spec 088): `chatOutboxMigrationSql` and its four tables with their
row-level security; a sender per organization with its credentials sealed (`connectChatSender`);
contacts and their consent; the organization’s words per kind of message; `queueChatMessage`,
`queueChatText`, `queueChatReply`, `deliverChat` with retries and the approved template;
`receiveChat`, the webhook that finds its organization by the provider’s account and checks it
with that organization’s own secret; statuses and cost category (`noteChatStatus`, `chatUsage`).
The port may answer with a `ChatReceipt`; `parseWhatsAppStatuses` and `whatsAppAccountsOf` read a
notification’s statuses and accounts.
