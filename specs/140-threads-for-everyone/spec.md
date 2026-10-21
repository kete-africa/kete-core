# Spec 140 — Threads for everyone, agents as delegates (`@kete/threads`, `@kete/channels`, `@kete/work`, `@kete/files`, `@kete/design`, `@kete/conversation`)

The author validated the canvas v6.2 on 2026-10-21 (« C'est complet ? Si oui, rédige toutes les
décisions et implémente de bout en bout »); the decisions are the doctrine's D-061. The center's
side is Kete Enterprise's spec 099. The reference screens are
[`docs/brief-ui/canevas-v6.2.html`](../../docs/brief-ui/canevas-v6.2.html).

## Why

Spec 139 made threads alive: unread, members, mentions, files, live, internal or outside. People
still stay in their WhatsApp groups and their mail because a thread lacks what every chat of today
has: voice notes, reactions, photos that show, pinned messages, a way to take a message back, pages
that stay fast. And two conversations coexisted — the threads and Kete Intelligence's — so Kete had
two memories. Agents could hold work without a person answering for it.

```mermaid
flowchart LR
  subgraph capture[capture]
    V[a voice note] & T[a message] & ML[a mail] & IM[an export]
  end
  capture --> TH[(the thread · @kete/threads)]
  TH --> R[reactions · pins · deletions · transcripts · citations # · pages]
  TH -->|for action| H[holding · a person holds it]
  H -->|delegated| A[an agent works it]
  A -->|done| RT[return to · the next step's person]
  TH --> UI[@kete/conversation · one composer in @kete/design]
```

## Contracts (additive)

- **`message.v1`** gains:
  - `references`: the objects it cites with « # ». Each is `{ kind, id, app? }`, at most 20.
  - `only_for`: the one person who reads it. Kete's private answer in a shared thread is the case
    that needs it.
  - On each attachment, `transcript` (a voice note's words) and `duration_ms`.
- **`holding.v1`** gains:
  - `delegate`: the agent working it for its holder.
  - `return_to`: whom the result goes to when done.

  A `holder` of kind `agent` stays readable, but is deprecated: a holding's holder is a person.

## Requirements

### Threads

- **FR-001 — Reactions.** A member reacts to a message with an emoji, and takes it back. Reactions
  are kept apart from the trace and announced live (`reaction`).
- **FR-002 — Pins.** A member pins a message, and unpins it. The pin keeps who and when, and an
  unpin keeps both.
- **FR-003 — Taking a message back.** Its author deletes a message. The thread then shows « Message
  supprimé », with who and when. The message itself stays in the trace and in the thread's export,
  where the proof reads it.
- **FR-004 — Voice notes.** A message carries an audio attachment with its duration. Its transcript
  is set once it is known (by the product's dictation port) and is searched like text.
- **FR-005 — Citations.** A message cites objects (`references`):
  - `citedIn` gives, for an object, the messages and threads that cite it, the latest first.
  - A thread is attached to more objects than its own (`attachThread`), and found from each.
- **FR-006 — Pages.** `messagesPage` gives the fifty messages before a point, and whether there are
  more. A search hit opens the page around its message.
- **FR-007 — Typing.** `announceTyping` tells the thread who is writing. It is announced, never
  kept.
- **FR-008 — What a thread holds.** `mediaOf` gives the thread's photos and videos, documents with
  their versions, links, voice notes and pins. Each item names the message where it was posted.
- **FR-009 — Files out of the database.**
  - A file is kept through a storage port that the product gives, up to 100 MB.
  - The files already kept in the database are still read.
  - `@kete-africa/files` gains a disk adapter for a single server and for development.
- **FR-010 — Only for one.** A message `only_for` a person is shown to her alone. `shareMessage`
  posts it for everyone, naming who shared it.
- **FR-011 — Telling.**
  - Each member sets her level for a thread: all, mentions, or none.
  - `whoToTell` gives who should be told of a message: the members whose level wants it, the people
    mentioned, and whoever must act. It never includes the author, nor anyone who has already read
    it.
- **FR-012 — Imports.**
  - `parseWhatsAppExport` reads a WhatsApp export, Android or iPhone, French or English: dated
    lines, multi-line messages, and attachments named.
  - `parseTelegramExport` reads a Telegram JSON export.
  - `importMessages` keeps them in a thread, dated, by their authors when they are known, marked
    imported. Importing again keeps nothing twice.
- **FR-013 — Merging.** Two threads are merged:
  - the messages of one move into the other, keeping their dates and authors;
  - the merged thread is put away, saying where it went.

### Mail

- **FR-014 — A reply finds its thread.** A received mail carries its `In-Reply-To` and
  `References`. The router places it first by them, from the mails that a thread sent or received,
  whatever the address it comes from.
- **FR-015 — What is read, and how it shows.**
  - A mailbox reads the INBOX, and the Sent folder when asked. The product's rule decides, mail by
    mail, what may enter: a known contact, the « Kete » folder, or a thread's address in copy.
  - A mail's text arrives cleaned: the quoted history and the signature are removed (with
    `email-reply-parser`), and the whole mail is kept beside it.
  - A mail read in two boxes is received once (its Message-ID).
  - `fromEml` reads a mail file to import it.

### Holdings

- **FR-016 — A person holds, an agent is delegated.**
  - A holding has a person for holder. `delegateHolding` gives it to an agent to work, and
    `undelegate` takes it back. Each is journaled.
  - An app that says an agent as holder is understood through the product's resolver: the agent's
    person becomes the holder, and the agent its delegate.
- **FR-017 — Return to.**
  - A holding says whom to return to: the step's person, by the policy or the circuit, else whoever
    entrusted it.
  - When it is done, `holding.returned` is journaled to that person, for the product to tell her.

### Screens

- **FR-018 — One composer.**
  - `@kete/design` gains `MessageField`, the composer of the canvas v6.2:
    - one line that grows, with 🎤 that becomes ➤;
    - ＋, « / », « @ », « # »;
    - files, a reply bar, a recording state;
    - the product's toggles.
  - Kete Intelligence's composer is made of it.
- **FR-019 — `@kete/conversation`.** The threads' screen, for any product, built against the canvas
  v6.2 and fed through a port (`ConversationClient`):
  - the list;
  - the conversation: grouped messages, day separators, « Nouveaux messages », photos, voice
    notes, links, citations, reactions, three gestures and « ⋯ », an agent's work in folded steps,
    « Seulement pour vous », typing;
  - « Infos du fil ».

  No component has a coloured left border.

## Proof

- A test for each requirement, on a real Postgres, in each package.
- The design preview shows `MessageField` and `@kete/conversation`. Each is screenshot beside the
  canvas v6.2, on a computer and a phone, in light and dark.

## Later

The per-thread mail address waits for the author's domain. The flow map of every module waits for
KYA's figures. Calls and meaning search in threads come later.
