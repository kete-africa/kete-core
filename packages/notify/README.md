# @kete/notify

How a Kete product speaks to people: **e-mails** rendered with **React Email** and sent through a
**port** (MailKite first, doctrine D-031), **verified provider webhooks**, and the **port of chat
channels** (WhatsApp, Telegram) the apps provide adapters for. No vendor name in business code
(doctrine D-014).

```mermaid
flowchart LR
    T["defineEmailTemplate<br/>subject + React Email body<br/>(words from the app's catalogs)"] --> M[createMailer]
    M -->|renderEmail: HTML + plain text| S{EmailSender port}
    S -->|MAILKITE_API_KEY| MK[mailkiteSender · POST /v1/send]
    S -->|no key| LOG[logSender · subject only]
    S -->|tests| MEM[memorySender]
    WH[MailKite webhook] -->|x-mailkite-signature| V[verifyMailkiteSignature]
```

## Use

```ts
const invitation = defineEmailTemplate<{ organization: string; link: string }>({
  name: 'invitation',
  render: (values, locale) => ({
    subject: m.email_invitation_subject(values, { locale }),
    body: <Invitation {...values} locale={locale} />, // React Email components
  }),
});

const mailer = createMailer({ sender: emailSenderFromEnv(), from: 'Kete <compte@kete.africa>' });
await mailer.send(invitation, { to, values, locale: 'fr' });
```

| Export                         | What it does                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `mailkiteSender`               | `POST /v1/send` with a domain-restricted key; says whether a failure may be retried    |
| `emailSenderFromEnv`           | MailKite with `MAILKITE_API_KEY`, otherwise `logSender` (nothing leaves)               |
| `logSender`, `memorySender`    | Development without a provider (logs the subject only, never the recipient); tests     |
| `renderEmail`                  | A React Email body to HTML and plain text                                              |
| `verifyMailkiteSignature`      | HMAC-SHA256 of `t.rawBody`, constant-time, within 5 minutes                            |
| `checkEmail`, `isEmailAddress` | Refuse a message without a valid sender, recipient or subject before any provider call |
| `ChatChannel`                  | The port of WhatsApp and Telegram: `sendText` with buttons, `sendDocument`             |

## Rules

- A service uses a key **restricted to its sending domain**, from its environment; the account key
  administers MailKite only.
- An e-mail's metadata carries facts (the template's name), never personal data.
- A secret link (sign-in, new password) never reaches a log: without a provider, only the subject
  is logged.

## Notifications in the product and on devices (spec 055)

A notification informs a person; what asks for an action lives in the product's « To do ». It is kept
in her list (`kete_notifications`, row-level security) and sent to every device she subscribed with
Web Push — the browsers' standard, with VAPID keys, through the `web-push` library. A device the
push service no longer knows (404, 410) is forgotten.

```mermaid
flowchart LR
  E[a product event: a decision waits for her] --> N[notify]
  N --> L[(kete_notifications · read or not)]
  N --> P{PushSender}
  P -->|KETE_VAPID_* set| W[webPushSender · web-push]
  P -->|none| X[stays in the product]
  W -->|404 · 410| G[device forgotten]
  B[her browser: PushManager.subscribe] --> S[(kete_push_subscriptions)]
```

```ts
await savePushSubscription(tx, { organizationId, userId }, subscription); // from the browser
await notify(
  tx,
  { organizationId, userId, kind: 'decision.waiting', title, href: '/a-faire' },
  pushSenderFromEnv(),
);
const unread = await unreadCount(tx, userId);
await markRead(tx, userId, 'all');
```

`generatePushKeys()` gives an instance its VAPID pair (`KETE_VAPID_PUBLIC_KEY`,
`KETE_VAPID_PRIVATE_KEY`, `KETE_VAPID_SUBJECT`).
