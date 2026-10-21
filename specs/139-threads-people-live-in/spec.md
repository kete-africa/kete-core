# Spec 139 — Threads people live in (`@kete/threads`, `@kete/channels`, `@kete/work`, `@kete/time`, `@kete/drafts`, `@kete/policies`)

The author's go came on 2026-10-21 (« écris la spec complète en corrigeant tout […] utilise au max
ce qui existe pour personnaliser. Écris et implémente, fais tout »), after testing the threads in
Kete Enterprise. The center's side, and what every app adds, is Kete Enterprise's spec 098
(`kete-enterprise/specs/098-threads-at-the-center`), which is the complete picture; this spec is
what the shared packages give it.

## Why

Spec 113 built the trace — a message never rewritten, « read by », for action or information, an
export as proof — but nobody lives in a thread yet: nothing arrives without reloading the page,
nothing says what is unread, nobody can be added, mentioned or sent a file, and a thread is born
only when someone outside writes. An enterprise's conversation is where its work moves; it has to
be at least as alive as the chat its people already use, and keep what only Kete has: the thread
belongs to an object, and what is asked in it becomes a holding with a holder.

```mermaid
flowchart LR
  subgraph thread[a thread]
    M[messages · internal or to the outside] --> R[(reads)]
    M --> F[(files · versions)]
    M -->|for action| H[holding · priority · due · snooze]
    M -->|@mention| N[told · joins]
  end
  M -->|pg_notify| L[listenThreads] --> S[the product's live stream]
  O[an object is born] -->|openThread| thread
  M -->|outside| C{the policy « who speaks for the company »}
  C -->|allowed| X[mail from her box · WhatsApp in its 24 h window, else a template]
```

## Contracts

- **`message.v1`** gains `visibility` (`internal` — between the organization's people and agents —
  or `outside` — said to the thread's contacts through their channel; a contact's own words are
  `outside`; absent means `internal`) and `moved_from` (the message this one was moved from; the
  original stays, saying where it went).
- **`holding.v1`** gains `priority` (`low`, `normal`, `high`, `urgent`; absent means `normal`),
  `snoozed_until` (a date-time before which « Pour moi » does not show it) and a `waiting_on` of
  kind `holding` (it waits on another holding, and comes back to its holder when that one is done).

Both are additive: a reader of the previous version reads the new one.

## Requirements

- **FR-001 — What is unread.** Each thread says how many messages its member has not read, and
  its last message (its author, its words, when). Writing a message reads it, and everything
  before it. A member may mark a thread unread from a message on. Threads are listed by their last
  activity.
- **FR-002 — Members.** A thread's holder, or an administrator, adds and removes members; a member
  may be a subscriber (told, nothing asked). Who left keeps the dates she knew (spec 113).
- **FR-003 — Mentions.** A message names the people and agents it mentions; each mentioned person
  becomes a member and is told; the product decides what an agent mentioned does.
- **FR-004 — Files.** A file joins a thread (10 MB at most), kept under its organization's
  row-level security with its name, type, size and fingerprint; a file sent again under the same
  name is a new version, the earlier ones kept. A message names its files; a thread lists them,
  each with its versions.
- **FR-005 — Moving a message.** A message said in the wrong thread is moved by its author or the
  thread's holder: the target gets it with `moved_from`, the source keeps the original and where
  it went.
- **FR-006 — Live.** Each change — a message, an edit, a move, a read, a member, a file — is
  announced through Postgres (`pg_notify` in the same transaction, so only what commits is
  announced). `listenThreads` gives a product these announcements to stream to its screens; a
  product without a direct connection to Postgres reads the latest changes instead
  (`changesSince`).
- **FR-007 — Internal or outside.** A message is internal unless its author says it is for the
  outside; only an outside message leaves by mail or WhatsApp. Saying it to the outside is the
  gesture `thread.speak_outside` (on the thread's object, through its channel), decided by the
  organization's policies (D-058, « who speaks for the company »).
- **FR-008 — WhatsApp answers.** An outside message to a contact on WhatsApp leaves as text within
  24 hours of her last message; after that, only through the organization's approved template,
  else it is refused with the reason (`@kete/channels`, `answerByChat`).
- **FR-009 — A thread born with its object.** `openThread` on an object is idempotent (spec 113);
  a product opens it when the object is created, with its holder, and may give it its own address
  for replies by mail when the product has a domain for them.
- **FR-010 — Holdings with a priority, a snooze, and a holding waited on.** « Pour moi » sorts by
  priority, then due day, then age; a snoozed holding comes back at its time; a holding waiting on
  another comes back to its holder when that one is done.
- **FR-011 — Delays the organization sets.** How long a holding waits on a colleague or an agent
  before it is nudged is a setting by priority (`kete.nudge_hours_urgent`, `…_high`, `…_normal`,
  `…_low`: 2, 8, 24 and 48 hours by default), and on a party outside a setting in days
  (`kete.party_nudge_days`, 2); in working hours, through « Réglages » as it exists. A holding
  waiting on another holding is never nudged. The relay stays the absences' (spec 111).
- **FR-012 — Her agenda in Outlook.** `@kete/time` writes a person's days as an iCalendar feed
  (`icsFeed`, built on `ical-generator`), which a calendar subscribes to; Kete Enterprise serves it
  under a secret, revocable address.
- **FR-013 — A draft anyone can read.** `@kete/drafts` describes a draft for its verification
  (`describeDraft`): each field with its label from the record's definition, its value formatted
  (money with its currency, dates, references by their names), and where it came from — so no
  app shows a raw draft again.
- **FR-014 — The six policies in plain forms.** `@kete/policies` gives templates
  (`policyTemplates`) for the six policies of D-058 — who commits the company, who speaks for it,
  spending limits by role and project, deputies, retention and confidentiality, consent of outside
  contacts — each a sentence with its blanks, turned into a Cedar rule checked against the schema;
  and `simulatePolicy`, which replays the journaled gestures of a period with a draft policy added
  and says which verdicts it would have changed.

## Proof

- Tests: unread counts and « mark unread »; a member added, told when mentioned, gone with her
  dates; a file and its second version; a moved message in both threads; a notification received
  by a listener only after commit; an internal message never leaves, an outside one is decided by
  the policy; WhatsApp inside and outside its window, with and without a template; priorities and
  a snooze in « Pour moi »; a holding waiting on another comes back; delays from the setting; an
  iCalendar feed parsed back; a draft described with labels and formatted money; a template saved
  as a valid Cedar rule; a simulation counting changed verdicts.

## Later

Retention enforced by deletion (a legal question first), reactions and threads within threads (no
user asked), a live presence (« typing ») — each when a person asks for it.
