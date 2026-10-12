---
status: accepted
date: 2026-10-12
decision-makers: the author (Jean-Claude), on the agent's proposal of 2026-10-12 (« Là, j'aimerais qu'on avance encore »)
---

# 0009 — A port ships with an adapter and an example; a lane's need is answered

## Context and Problem Statement

The apps were built on the published packages only (doctrine D-034). Reading Nettio, Firmo and Kete
Enterprise side by side on 2026-10-12 shows where they wrote the same thing again:

| Written again                                    | Where                                                                      | What the chassis had                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| WhatsApp and Telegram adapters, inbound webhooks | Firmo, then Nettio (« written from Firmo's »)                              | The `ChatChannel` port in `@kete/notify`, no adapter |
| The assistant: its rules, its loop, its screen   | Kete Enterprise (about 6,000 lines with agents, routines, gateway), Nettio | `ask` and `toolsFrom` in `@kete/ai`                  |
| Form fields, business roles, a gesture's result  | Nettio (`kete-core#86`, eight pieces)                                      | `TextField`, `createRights`, the template's sample   |
| Legal numbering                                  | Nettio, four counters                                                      | Nothing                                              |

Two causes, neither a fault of the apps:

1. **The chassis delivered ports and primitives, not finished capabilities.** A port without an
   adapter is finished by each app, each time.
2. **The way back had no answer.** `kete-core#86` listed what Nettio had to write on 2026-10-08;
   four days later it had no reply. The lanes rule says a need crosses lanes as an issue; it does
   not say the issue is answered.

The cost is not only duplication. On 2026-10-12 both copies of the WhatsApp adapter read the
sender's phone number from a field the provider no longer guarantees (business-scoped user ids):
one defect, to be fixed once per copy.

## Decision Drivers

- Constitution I: « simple and working » — a port alone is not working.
- Constitution II: build what has already hurt — a piece written twice has hurt twice.
- Doctrine D-034: packages are consumed as published versions; needs cross lanes as issues.
- Doctrine, 2026-10-04: use what exists; never rebuild what a proven library does.

## Considered Options

- Leave the rules as they are, and extract when someone has time.
- Let apps import one another's code.
- Two rules in the constitution: a port ships with an adapter and an example; an issue from another
  lane is answered in the workshop's next cycle.

## Decision Outcome

Chosen option: the two rules, because they close both causes without weakening the lanes.

1. **A port never ships alone.** A port enters a package with at least one adapter and one working
   example — in the template, or in a test that runs the adapter against the provider's recorded
   payloads. An interface whose first adapter lives in an app is not delivered.
2. **A need from another lane is answered.** An issue raised by an app or by Kete Enterprise gets
   its answer in the workshop's next cycle: **taken** (with its spec number), **refused** (with the
   reason), or **parked** (with the event that reopens it).

A third consequence, not a rule: what a proven library already does is taken from it. The agents'
runtime is tried on the library the roadmap named (Mastra, spec 057) before any hand-written loop
is extracted into a package; the trial's result is its own decision record.

### Consequences

- Good, because an app deletes code when the chassis moves, instead of copying it.
- Good, because a provider's change is fixed once.
- Bad, because a package takes longer to publish: its adapter and its example come with it.
- Bad, because the workshop owes an answer to every issue, including « no ».

### Confirmation

- A package's README names its adapters; `docs/ROADMAP.md` lists each open issue from another lane
  with its answer.
- Phase 7 of the roadmap closes on apps deleting their copies, their tests unchanged.

## More Information

Reversed if the lanes merge into one repository. Related: `kete-core#84`, `kete-core#86`, decision
0008 (durable workflows), doctrine D-034.
