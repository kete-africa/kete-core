# Feature Specification: Messages, and the Compte Kete's e-mails

**Feature Branch**: `025-notify`
**Created**: 2026-09-30
**Status**: Implemented
**Input**: Doctrine D-014, D-030 (`@kete/notify`), D-031 (MailKite first). The Compte Kete only
logged its invitations and had no way to choose a new password; the handoff of the apps lane listed
"password reset, waiting for an e-mail service". Firmo has its own chat channels.

## User Scenarios & Testing

### User Story 1 — E-mails through a port (P1)

1. **Given** `MAILKITE_API_KEY`, **Then** e-mails leave through MailKite (`POST /v1/send`); a 4xx
   is a refusal, a 5xx, a 429 or a network failure may be retried.
2. **Given** no key, **Then** nothing leaves, and only the subject is logged — never the recipient
   nor a secret link.
3. **Given** a template, **Then** it renders in the recipient's language as HTML and plain text,
   its words coming from the app's catalogs.
4. **Given** a MailKite webhook, **Then** only a fresh, correctly signed body is trusted.

### User Story 2 — Invitations (P1)

1. **Given** an owner or admin inviting someone, **Then** the invited address receives the link.

### User Story 3 — A new password (P1)

1. **Given** an account with a password, **When** its owner asks on `/forgot-password`,
   **Then** the owner receives a link valid one hour, chooses on `/reset-password` a new
   password, every other session closes, and the old password opens nothing.
2. **Given** an account without a password (passkeys only, or provisioned by phone), **Then** it
   receives an e-mail saying why, and no password is ever added through e-mail (spec 016).
3. **Given** an unknown address, **Then** nothing is sent, and the screen says the same as always.

## Requirements

- **FR-001**: `@kete/notify`: `mailkiteSender`, `logSender`, `memorySender`, `emailSenderFromEnv`,
  `defineEmailTemplate`, `createMailer`, `renderEmail`, `verifyMailkiteSignature`, `checkEmail`,
  and the `ChatChannel` port.
- **FR-002**: The Compte Kete sends through it (`platform/email.ts`), with React Email templates in
  `features/emails/templates.tsx` and their words in `messages/{fr,en}.json`.
- **FR-003**: Better Auth `sendResetPassword` only for an account with a password;
  `revokeSessionsOnPasswordReset`; token valid one hour; two screens, French and English.
- **FR-004**: `MAILKITE_API_KEY` and `ACCOUNT_MAIL_FROM`; operations list the author's steps
  (domain verification, restricted key, Coolify).

## Out of scope

- Turning on e-mail verification: it would lock out existing unverified accounts — its own decision.
- Moving Firmo's WhatsApp and Telegram adapters behind `ChatChannel` (apps lane).
- A queue for e-mails (retries in the background) comes with the app template's worker (spec 028).

## Success Criteria

- **SC-001**: The 8 tests of `notify` pass (adapter contract, webhooks, rendering, senders).
- **SC-002**: The Compte Kete's 4 e-mail tests pass on its `test` branch (invitation, reset,
  passkey-only account, unknown address).
- **SC-003** `[blocking]`: with MailKite configured on staging, a real reset e-mail arrives and its
  link works.
