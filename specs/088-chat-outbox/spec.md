# Spec 088 — The outbox to people: consent, templates, a sender per organization, the cost

Status: **design, for the author's reading before any code** (step B2 of the plan decided on
2026-10-13). Nothing below is built yet.

## Why

Spec 087 gave the adapters. What every app still writes by hand is what sits between « something
happened » and « a message left »: whether the person agreed to be written to, which words, through
which channel, from whose number, and what happened to it. Nettio wrote it for its customers
(`src/features/messaging`, 1,100 lines); Firmo has its own; Kete Enterprise will need it to carry a
decision to a manager's phone (its step C2).

Nettio's decision 0004 kept one sender per channel for the whole deployment, « acceptable for one
pilot, not for the sale of Nettio alone »: two laundries sharing a number would both answer a
customer they have in common. The chassis ships the durable form: **a sender per organization**.

## What it is

```mermaid
flowchart LR
  A[the app: « her deposit is ready »] -->|queueChatMessage| Q[(kete_chat_messages · queued)]
  Q --> R{may it leave?}
  R -->|no consent · template off · no sender| S[skipped, with its reason]
  R -->|yes| D[deliverChat · the worker]
  D -->|the organization's own sender| C[ChatChannel]
  C -->|refused| F[failed, with the reason · retried or not]
  C -->|sent| M[sent · delivered · read]
  W[the provider's webhook] -->|which account?| O[kete_chat_organization_of_account]
  O -->|organization, identifiers only| I[heard in that organization]
  W -->|statuses| M
```

## The tables

Each carries its organization and its row-level security in the same migration (constitution V).

| Table                | Holds                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kete_chat_senders`  | One row per organization and channel: the provider's account (what routes a webhook), what people see (the number, the bot's name), its credentials **sealed** |
| `kete_chat_contacts` | Who can be written to: the app's own reference of the person, her address on a channel, the provider's scoped id, her consent and its date, her link token    |
| `kete_chat_templates` | The organization's words per kind of message: on or off, the text, the provider's approved template and its language                                         |
| `kete_chat_messages` | Every message, out and in: its kind, its text, its status, the reason when it did not leave, attempts, the provider's id, what it cost                        |

## Requirements

- **FR-001 — Consent first.** Nothing is queued to leave for a contact who did not agree, or who
  withdrew: the message is kept as `skipped` with the reason `no_consent`. Consent is given by a
  named gesture, never inferred from a first message.
- **FR-002 — The organization's words.** A kind of message leaves only when the organization
  switched its template on. Its text takes named values; an unknown placeholder is refused when
  the template is saved, not when a message leaves.
- **FR-003 — A sender per organization.** A message leaves from the organization's own number or
  bot. Without one, the message is `skipped` with `not_connected` — never sent from another
  organization's sender, never simulated.
- **FR-004 — Credentials sealed.** A sender's token and secrets are sealed with AES-256-GCM under
  a key the deployment holds outside the database (`KETE_SECRETS_KEY`, 32 random bytes), as Kete
  Enterprise already seals a person's own AI key. They are opened only to send or to check a
  webhook; they never appear in a journal, an error, a log or an answer of the API. A row sealed
  under another key opens as nothing: the sender is shown as « to reconnect ».
- **FR-005 — A webhook finds its organization by the provider's account.** One address per
  deployment and channel. A notification names the account it was sent to; one `security definer`
  function answers with the organization's identifier **only**. Its signature is then checked with
  that organization's own secret. Two more functions find a contact by her address or by her link
  token, identifiers only. Nothing else crosses the organizations' boundary; the migration says so
  and a test proves it.
- **FR-006 — Every message keeps what happened to it.** `queued`, `sent`, `delivered`, `read`,
  `failed`, `skipped`, `received`, with the reason (`ChatChannelError`'s) and the number of
  attempts. A `network` failure is retried with a delay; `outside_window` falls back to the
  approved template when there is one; `recipient_unreachable` and `needs_phone_number` are not
  retried.
- **FR-007 — Heard once.** An inbound message is kept by its provider's identifier; a provider
  that delivers twice is heard once.
- **FR-008 — What it cost.** The provider's delivery statuses say whether a message was billed and
  in which category. Each message keeps both; an organization reads its count per month and per
  category. No amount is invented: a price is only shown when the deployment was given one.
- **FR-009 — The port tells what was sent.** `sendText`, `sendTemplate` and `sendDocument` may
  answer with the provider's identifier of the message, so that a status finds its message. An
  adapter that answers nothing still satisfies the port.
- **FR-010 — A contact who hides her number.** A contact is found by her number when the provider
  gives it, by its scoped id otherwise; the first message of an unknown scoped id is kept, and she
  is tied to a contact by her link token.

## What the app keeps

The app decides **when** a message is due and with **which values** (« her deposit A-0412 is
ready »), and what an inbound message means for its trade. The chassis decides whether it may
leave, sends it, and keeps the trace.

## Open questions for the author

1. **The key.** One `KETE_SECRETS_KEY` per deployment seals every organization's sender. Losing it
   means every organization reconnects its number. Is that acceptable, or should each organization
   hold its own key?
2. **Who connects a number.** Connecting a WhatsApp number needs the organization's own account at
   the provider. Should an operator of Kete do it for the first clients, from Kete Cockpit?

## Not in this spec

Calls, groups, broadcast campaigns, a shared inbox for a team. The price list of a provider.

## Proof to obtain

- Two organizations with two senders: a message of one never leaves from the other's, and a
  webhook for one account is never heard in the other organization.
- A message for a contact without consent is `skipped`, with its reason, and nothing leaves.
- A row of `kete_chat_senders` read by the application role shows no credential; a row sealed
  under another key cannot be opened.
- A provider that delivers twice is heard once; a status finds its message and records its cost
  category.
- Nettio replaces `src/features/messaging/infrastructure/outbox.ts` with it, its tests unchanged.
