# Spec 104 — Proposals and voice

Step **L6** of phase 9 (`docs/ROADMAP.md`; doctrine D-051, D-054): at the end of her day a person
writes or says what it was; the assistant proposes gestures on what she has — never on what she
does not — she ticks them, applies them together by one gesture, and may undo them together. Her
voice comes through the dictation port, on the screen and in a WhatsApp or Telegram voice note.

## Why

The method (D-051) ends the day with « noter »: one sentence or one voice note that tidies the day.
Without it, the evening is a list of screens to open — close this task, move that report, set a
reminder. An agent may propose; a person decides, and must be able to take it all back. A gesture
a model invents on an object she does not have is worse than none.

```mermaid
sequenceDiagram
  participant P as The person
  participant S as The app · /soir or a voice note
  participant D as The dictation port (@kete/ai)
  participant U as understand (@kete/ai)
  participant K as Proposal sets (@kete/drafts)
  P->>S: « J'ai fini le devis ; le rapport attendra lundi » — written or said
  S->>D: the recording, when said (wordsOf for a voice note)
  D-->>S: the text
  S->>U: the text, today, her open tasks, the gestures the app offers
  U-->>S: gestures on known objects, their level from the app; what is unclear
  S->>K: proposeSet (origin closure)
  P->>S: ticks, « Appliquer »
  S->>K: applySet — each through its capability, under her rights; level 4 waits
  P->>S: « Tout annuler »
  S->>K: undoSet — the last first
```

## Requirements

- **FR-001 — A proposal set is kept for its person** (`@kete/drafts`): in the contract
  `proposal-set.v1` — whose items now carry the capability's `input` (additive) — with two items
  never sharing a key; in its organization only (RLS in the same migration); frozen once dismissed
  or undone.
- **FR-002 — Applied together, undone together**: only a person decides; the ticked items are
  applied in their order, each through the app's capability; a failure does not stop the others; a
  level 4 item is not applied — it asks its own confirmation; undoing reverses what was applied,
  the last first, with what applying it returned; each item says what became of it.
- **FR-003 — A note understood, never guessed** (`@kete/ai` `understand`): the gestures a note
  proposes, each on an object the app knows and a gesture it offers; level and capability from the
  offer; up to level 2 ticked; an object she does not have, a gesture not offered, or a gesture
  that needs an object without one is left out; what could not be placed is said back.
- **FR-004 — A voice note's words** (`@kete/notify` `wordsOf`): a text as it is, a voice note
  fetched from its channel and written by the dictation port; anything else, or a silence, none.
- **FR-005 — The parts** (`@kete/design`): `ProposalList` (ticks, level, her words, outcomes,
  apply, dismiss, undo) and `VoiceCapture` (records nothing before she presses; stops at a limit).
- **FR-006 — A generated app closes its day**: the template's `/soir` (« Ma journée ») — her note
  or her voice (when `KETE_DICTATION_*` is set), the gestures proposed on her open tasks, applied
  and undone; another person's set is not hers to decide.

## Proof

- `packages/drafts/tests/proposals.test.ts` (4): kept in the contract, refused when it breaks it or
  repeats a key; an agent cannot decide; applied with a failure and a level 4 waiting; undone with
  what applying returned; dismissed and frozen by the database; isolated by organization.
- `packages/ai/tests/understand.test.ts` (2): three gestures kept, an invented task, a gesture not
  offered and one without its object left out, the unclear part said back, the result valid in the
  contract; an empty note asks nothing; level 3 comes unticked.
- `packages/notify/tests/chat.test.ts` (2): a text and a voice note's words; none for a photo, a
  silence or a channel that cannot download.
- `packages/design/tests/proposals.test.tsx` (3).
- `templates/app/tests/complete.test.ts`: a note closes her task — another person cannot apply
  it — and undoing reopens it, in the database.
- In the design preview (« soir »): four gestures from a note, three ticked; applied — the level 4
  one left; undone together.

## What stays for later

The morning's pile and the phone's own screens (L8), the evening's voice closing the day in Kete
Enterprise (C2), a voice note heard on WhatsApp answered with its proposals as a list to tick
(apps G4–J2), and lessons proposed to a skill's owner (L7).
