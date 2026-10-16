---
status: accepted
date: 2026-10-15
decision-makers: the author (« quel est ton plan pour aller au bout en commençant par l'unification ? », then « Super, actualise la doc »), on the proposal
---

# 0011 — The core in layers, and the living model's primitives

## Context and Problem Statement

kete-core has 32 published packages, each with one responsibility, a port and an adapter. They sit
side by side: nothing says which are foundations, which keep writes safe, which are AI, which read,
which draw. Some frontiers blur (`ai`, `agents`, `intelligence`; `metrics`, `boards`, `analytics`;
`knowledge`, `skills`, `files`), and the primitives every Kete app needs to run a company — a thing
in progress with its holder, a thread, a policy, the references every app cites — do not exist in
the core. Doctrine D-056 to D-058 now decide the living model; the core must say where it goes.

## Decision Drivers

- D-056: one living model — the journal, the thread, the holding, the gesture, the policy — with a
  router; no holding without a holder.
- D-058: one policy engine, evaluated at the gesture, for a person and an agent alike.
- A module enters the core only when two consumers need it (phase 9).
- Vendors stay behind ports, each port with its adapter (0009).

## Considered Options

- Keep the packages flat; describe them in the README only.
- Move the packages into layer folders on disk.
- Write the layers down, keep the paths, and add the living model's primitives as new packages.

## Decision Outcome

Chosen option: "Write the layers down, keep the paths, and add the primitives", because moving
32 published packages buys nothing a reader needs, while the missing primitives block the
unification.

The layers, from the bottom; a package depends only on its own layer and the ones below:

1. **Foundations** — `tenancy`, `identity`, `auth`, `log`, `jobs`, `files`, `money`, `sequences`,
   `testing`.
2. **Safe writes** — `records`, `commands`, `drafts` (the gestures) and, new, **`policies`**: a
   policy is a sentence with its scope, owner, version and trial; it answers at the gesture —
   allowed, allowed with a circuit's approval, refused with the policy that refused.
3. **The shared domain**, new — the contracts of the center's references (person, party, project;
   later place, asset, catalogue item, group); **`work`**: the holding (`holding.v1`), its states,
   the rule that it always has a holder, and the relay (age, nudge, deputy, manager);
   **`threads`**: a thread attached to an object, its members (people, agents, contacts through a
   channel), its messages, cards and events.
4. **Exchanges** — the contracts, `sdk`, `notify`, `payments` and, new, the inbound **channels**
   (WhatsApp Business, IMAP) feeding the journal, with the **router** that ties each event to its
   object, thread and holding, or raises a card « à classer ».
5. **AI** — `ai` → `agents` → `intelligence`; `capabilities`, `skills`, `lifecycle`, `sandbox`,
   `knowledge`.
6. **Reading** — `time`, `metrics` → `boards`, `analytics`.
7. **Screens** — `design`, `shell`, `views`, `feedback`, `create-app`.

Apart: `center` is Kete Enterprise's client; `admin` is the Kete operators' space.

### Consequences

- Good, because every Kete app gets the same holdings, threads and policies, and the center
  gathers them without translating six models.
- Good, because a reader finds where a new package belongs before writing it.
- Bad, because `work`, `threads` and `policies` take over models that already work in Kete
  Enterprise (requests, to do, meeting actions, circuit steps, drafts, agent tasks; the assistant,
  exchanges, phone, notifications, mail; circuits and agents' rules). Each moves one source at a
  time, its old tables retired after.

### Confirmation

- `docs/ROADMAP.md`, phase 10, orders the work; each package lands with its contract, its tests
  and its README with a diagram.
- A review checks that no package depends on a layer above its own.

## More Information

Doctrine D-056 (the living model), D-057 (the screen: « Pour moi », the conversation in the
middle, the state beside), D-058 (one policy engine). Before any of this is coded, a complete
simulation of the flow (HTML, CSS, JS) is validated by the author. The author, then KYA, test at
the end. Reversed if the simulation shows the flow does not hold.
