---
status: proposed
date: 2026-10-16
decision-makers: the author (« fais une proposition dans le chat », then « allez note tout et sois prêt pour mon ok d'implémentation »), on the proposal
---

# 0012 — Technical choices for the living model's modules

## Context and Problem Statement

Decision 0011 places the living model's primitives in the core: the journal, holdings and the
relay, threads, policies, inbound channels and the router. Each module needs its inputs and outputs
as contracts, its features, and the open-source projects or libraries it stands on. They must be
chosen before any of them is coded, and the open questions said, so that the author's go starts
the implementation without a second debate.

## Decision Drivers

- Postgres is the one backbone: events, queues, search, vectors, realtime. A separate service only
  when it is clearly better (Gotenberg for PDFs is the precedent).
- Libraries run in the process; vendors stay behind ports, each port with its adapter (0009).
- Every input and output is a versioned JSON Schema contract, validated with Zod.
- Figures are computed by code, never by a model (doctrine).
- No Docker on the author's machine: tests run against Neon branches (`@kete/testing`).

## Considered Options

- A stack of services: Kafka for events, Temporal for timers, a chat server (Matrix, Mattermost),
  OPA or Cerbos for policies.
- An ERP as the base (Odoo, ERPNext), with Kete on top.
- Postgres as the backbone, in-process libraries, and our own code where the model is ours.

## Decision Outcome

Chosen option: "Postgres as the backbone, in-process libraries, our own code where the model is
ours", because the holdings, the relay, the gesture and its policy are what make Kete different —
a chat server or an ERP would have to be translated into them — while Postgres and pg-boss already
cover events, timers and search at our scale.

### The backbone, shared by every module

| Need               | Choice                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------- |
| Data               | Postgres (Neon), the organization as the hard boundary (RLS, `@kete/tenancy`)          |
| Journal            | An append-only table and an outbox (`@kete/commands`, `@kete/sdk`), signed, replayable |
| Queues and timers  | pg-boss (`@kete/jobs`): nudges, deadlines, agents' triggers                            |
| Realtime on screen | Postgres `LISTEN/NOTIFY`, forwarded as Server-Sent Events by Hono                      |
| Search             | Postgres full text, pgvector, pg_trgm, fused (reciprocal rank fusion)                  |
| Contracts          | JSON Schema in `contracts/`, Zod at every edge                                         |

### The modules

**Channels** (what the outside says) — package `@kete/channels`.

- In: WhatsApp Cloud API webhooks (Meta, directly), Telegram updates, IMAP mail, form submissions,
  payment providers' webhooks.
- Out: `event.v1` (message received, attachment, payment received); outgoing messages.
- Features: a channel port; WhatsApp templates, the 24-hour window, consent and opt-out; a mailbox
  per person (IDLE for new mail, SMTP from her own box, APPEND to her Sent); one address per thread
  for replies by mail; a mailbox password entered by an administrator and sealed, never in a file.
- Stands on: ImapFlow (IMAP with IDLE), mailparser, Nodemailer (SMTP), grammY (Telegram),
  libphonenumber-js. WhatsApp through Meta's official API, without a third-party library.

**Router** (each event tied to its object) — in `@kete/channels`.

- In: `event.v1`. Out: `routing.v1` (object, thread, holding, intent, confidence) or a card
  « à classer ».
- Features: rules first (a known number, a known address, a thread's address), then the model's
  structured output for the intent (incident, invoice request, quote request…), a confidence
  threshold under which a person decides, and learning: a card classified by a person becomes a
  rule. When information is missing, it asks the right person in one line instead of guessing.
- Stands on: pg_trgm and the contacts for the sender; the AI SDK's structured output behind
  `@kete/ai`.

**Work** (holdings and the relay) — package `@kete/work`.

- In: `holding.v1` (created, waiting, done), absences (dated facts from Time), gestures' decisions.
- Out: holding events (created, waiting, nudged, taken over, done); « Pour moi »; fluidity figures
  (oldest wait, waits over 48 hours, human time per sale).
- Features: the holding's states; no holding without a holder, checked continuously; deputies and
  managers from the structure; nudges in working hours; a holding handed back with a reason.
- Stands on: pg-boss for timers; a typed state machine of our own (five states do not need
  XState).

**Policies** (who may do what) — package `@kete/policies`.

- In: `gesture.v1` (actor, person or agent; kind; amount; object; channel; third party).
- Out: `policy-decision.v1`: allowed, allowed with a circuit's approval, or refused, with the
  policies involved and their explanation.
- Features: a policy written as a sentence, proposed as a rule by the model and validated by a
  person; scope, owner, version; « on trial » observes without blocking; circuits of approval
  (taken from Kete Enterprise's `decisions`); the six missing policies (who commits the company,
  who speaks to clients, spending limits, deputies, retention and confidentiality, consent).
- Stands on: **Cedar** (open source, by AWS), run in the process through its WebAssembly build:
  readable policies, conditions on attributes, explained decisions, formal analysis of conflicts.
  OPA and Cerbos are left aside (a separate service); CASL fits screen permissions, not thresholds
  and approvals.

**Threads** (where people talk) — package `@kete/threads`.

- In: messages from people, agents and channels; cards; events.
- Out: message events, read receipts, an exported proof.
- Features: a thread born with its object; groups from the structure and created ones, each with a
  holder; members (people, agents, contacts through their channel); replies, mentions, reactions,
  attachments, voice notes; an edit keeps the original; « read by » with its date; « for action »
  becomes a holding, « for information » a message; cards settled everywhere; retention by policy;
  a thread exported as a timestamped PDF with its journal; a daily digest by mail for whoever still
  prefers mail, answered by mail.
- Stands on: Postgres and Server-Sent Events; Gotenberg for the PDF. Matrix, Mattermost and
  Rocket.Chat are left aside: full servers whose model knows neither holdings nor policies.

**Agents and Kete Intelligence** — existing `@kete/agents`, `@kete/intelligence`.

- In: triggers (an event, a time, a mention in a thread); the person's capabilities.
- Out: gestures and drafts (`proposal-set.v1`); `intelligence-event.v1`.
- Stands on: Mastra (0010), the official MCP SDK, promptfoo or Mastra's evaluations for skills'
  tests drawn from lessons.

**Notes and voice** — existing `@kete/ai` (`understand`), `@kete/drafts`.

- Transcription behind a port: Whisper through an API first; an open model (Mistral's Voxtral)
  when the data must stay home. Receipts and paper read by a vision model, not Tesseract.
- To prove with real notes in spoken French.

**Time, Boards** — existing `@kete/time`, `@kete/metrics`, `@kete/boards`; rrule, ical-generator,
ical.js, the Temporal polyfill; ECharts and react-grid-layout v2 on screen; SQL for figures.

**Knowledge** — existing `@kete/knowledge`, `@kete/skills`; pgvector and full text fused; unpdf and
mammoth to read PDF and Word in the process; the Agent Skills standard. Docling and unstructured
(Python services) only if KYA's documents require them.

**References** (places, assets, catalogue, group) — contracts in the core, tables in the center.
For KYA's solar systems: PVGIS (European Commission, free, covers Africa) for a place's irradiation,
NASA POWER as a fallback; a pre-sizing in versioned, tested TypeScript formulas; pvlib (Python, the
field's reference) in `@kete/sandbox` for a fine calculation, rather than rewriting the physics.

**Payments** — existing `@kete/payments` (Chariow); a mobile-money aggregator for West Africa
(CinetPay, FedaPay, PayDunya or Moneroo), chosen with KYA's countries and fees.

### What is refused

- Kafka, Temporal, Inngest: services for what Postgres and pg-boss do at our scale.
- A chat server: everything would have to be translated into holdings, policies and rights.
- An ERP as the base: its model (module and form) is the opposite of ours (journal, holding,
  gesture). Kete connects to it when a client has one.

### Consequences

- Good, because one database, one journal and one set of contracts serve every module and app.
- Good, because each library is replaceable behind its port.
- Bad, because spoken-French transcription is not yet proven for us; it is checked first in its
  step. Cedar and WhatsApp's rules were checked on 2026-10-16 (below).

### Confirmation

Each module lands with its contracts, its tests on a Neon branch, its README with a diagram; each
step's spec cites this decision.

## More Information

Open questions for the author, to settle before or within their step:

1. Cedar for policies: a first trial on the six policies. **Checked on 2026-10-16**
   (`specs/112-policies/first-check.md`): 17 of 17 gestures decided right, 2 ms a decision with
   preparsed policy sets, 4.3 MB of WebAssembly; three policy sets give the three effects. Its
   symbolic analysis is not in the WebAssembly build: contradictions are caught by a table of
   expected decisions instead. **Kept** on 2026-10-16 (the author: « suis le plan »):
   `@kete/policies` (spec 112).
2. WhatsApp: Meta's API directly, or through an approved provider (BSP) handling templates and
   billing. **Meta's rules checked on 2026-10-16**: since 15 January 2026 the WhatsApp Business
   Solution Terms bar « AI providers » whose general-purpose assistant is the product itself;
   AI serving one business (its clients, its people, its tasks) stays allowed, and Meta judges
   what is « primary ». The European Commission ordered interim measures against the ban on
   9 June 2026; outside the EU (Togo, KYA) the terms apply as written. What follows for Kete:
   each organization connects **its own** WhatsApp Business number and Kete Intelligence answers
   only about that organization (never a shared Kete number with a general assistant); messages
   outside the 24-hour window go through approved templates (a card to decide is a « utility »
   template); opt-in and STOP are kept by policy 6. Proposed: Meta's Cloud API directly, Kete
   registered as a Tech Provider so an organization connects its number by Embedded Signup; a BSP
   only if a client already pays one.
3. Transcription: through an API (simple, paid per use) or a hosted open model (data kept home).
4. PV sizing: TypeScript formulas only, or pvlib from the start.
5. KYA's mobile-money aggregator.

Examples from KYA that the modules must serve (2026-10-16): « L'ordinateur de Phébé a un souci »
— a sentence in a thread becomes a holding for the IT holder, a drafted anomaly report (KYA's own
procedure, ISO 9001), the asset's history, a loan proposed; a quote request through a form for a
solar system — a new client, a place, a holding « dimension and price », a sizing computed by code
from the place's irradiation, a quote from the catalogue checked by an engineer, then sent.
Doctrine D-056 to D-058; decisions 0011.
