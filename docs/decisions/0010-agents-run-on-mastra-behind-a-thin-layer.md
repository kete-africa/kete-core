---
status: accepted
date: 2026-10-13
decision-makers: the author (Jean-Claude) chose Mastra for the agents' runtime on 2026-10-13, subject to a one-day trial; the agent ran the trial the same day, and its measures are below
---

# 0010 — Agents run on Mastra, behind a thin Kete layer

## Context and Problem Statement

Every Kete product has an assistant, and Kete Enterprise has agents that work on their own
(routines, tasks, agents a colleague shares). Each wrote its own loop on `ask` and `askStream` of
`@kete/ai`: Kete Enterprise about 6,000 lines with agents, routines and a gateway, Nettio 200 for
« Demander » (decision 0009). What the plan of 2026-10-13 asks next — conversations that are
remembered, memory with its governance, agents that run for long and wait for a person, evaluations
— is what a runtime gives, and what we would otherwise write a third time.

What makes an agent a _Kete_ agent is not its loop: it acts for a person and never has more rights
than her, what commits is a draft she confirms, everything it did is journaled, its usage counts
against a budget, and its data stays inside its organization (doctrine D-043, D-044). That part must
stay ours, and small.

The question was whether a proven runtime can carry the loop without taking that part away. It was
tried for a day under Nettio's assistant before deciding.

## Decision Drivers

- **Prefer what exists.** A planned library is used and dressed, not rebuilt.
- **No extra service.** A library in the process; nothing to host, nothing that calls home.
- **Security in the database.** Every table carries its organization and its row-level security;
  the application role bypasses nothing.
- **Reversible.** « Souverain et réversible » (doctrine D-043): the day the runtime no longer fits,
  leaving it is a small, known piece of work.
- **The AI SDK stays.** Models, providers and the chat screen (assistant-ui) are built on it.

## Considered Options

- **Keep our own loop** on the AI SDK (`ask`, `askStream`) and write memory, long runs and
  evaluations ourselves.
- **Mastra** (`@mastra/core`, Apache 2.0) as the runtime, with a thin Kete layer.
- **CopilotKit with AG-UI**: set aside before the trial — a second interface stack beside
  assistant-ui, and no answer to the questions above.

## The trial (2026-10-13)

Run on a branch of Nettio, `@mastra/core` 1.76.0, `@mastra/memory` 1.37.0, `@mastra/pg` 1.31.0,
with `ai` 7.0.122.

| Question                                                | Measure                                                                                                                                                                                                                     |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does Nettio's assistant run on it, its tests untouched? | Yes. The 27 tests of `assistant.test.ts` and `ask-by-messaging.test.ts` pass unchanged: rights, drafts, what is never offered to the model, usage recorded as the agent acting for the person, a spent budget, the stream.  |
| Does it take the models and tools of the AI SDK 7?      | At run time, yes, as they are. Its types do not say so: a `LanguageModel` and an AI SDK `tool()` need one cast each.                                                                                                        |
| Can its tables live under row-level security?           | Yes. The conversation tables (5) are exported as SQL without a connection; each takes an `organization_id` and the standard policy. As the application role, another organization reads nothing, with the same identifiers. |
| Does it need its own connection, its own role?          | No. It takes the app's pool. It knows nothing of organizations: it is handed a view of the pool where every statement runs in a transaction that carries one, as `inOrganization` does.                                     |
| What does it create by default?                         | 39 tables when the whole store is initialised (agents, skills, workspaces, schedules, channels, datasets, experiments…). We create the 5 of its conversations, by our own migration, and nothing else until a spec asks.    |
| What does it weigh?                                     | +94 packages, 80 MB on disk; loading it takes 0.9 s (the AI SDK: 0.16 s). The assistant's tests take the same time with it (46 s) as without (45 s).                                                                        |
| Does it call home?                                      | It ships `posthog-node` and reports usage unless `MASTRA_TELEMETRY_DISABLED` is set. Our layer sets it before the runtime loads.                                                                                            |
| Its licence?                                            | Apache 2.0, except the folders named `ee/` (`auth/ee`, `agent-builder/ee`), under its enterprise licence: not imported.                                                                                                     |
| Its pace?                                               | From 1.47 (the first release that takes AI SDK 7 models) to 1.76 in about three and a half months: two minor versions a week.                                                                                               |
| What does the loop alone bring over `ask`?              | Nothing we lacked. Its worth is in what comes next: conversations kept, working memory, long runs that suspend and resume, sub-agents, scorers.                                                                             |

## Decision Outcome

Chosen option: "Mastra, behind a thin Kete layer", because it carries the loop and what the plan
asks next without taking away what makes an agent a Kete agent, and because the trial found no
obstacle that a small layer does not hold.

- A new package, **`@kete/agents`**, is the only place that imports the runtime. An app never
  does.
- **`@kete/ai` stays what it is**: the port of models, `ask`, `extract`, usage and budgets, with
  no runtime in it. An app that only asks a question carries no agent runtime.
- The layer gives the runtime **the caller's capabilities as its only tools**
  (`registry.tools(caller)`): rights, mandate, drafts and journal come with them and are not
  written again. It measures usage, enforces budgets, and tells a page what happens in four events.
- The runtime's tables are **created by our migration, frozen in our source**, each with its
  organization and its policy. The runtime's own initialisation never runs.
- The runtime's versions are **pinned exactly** and raised on purpose.

### Consequences

- Good, because Nettio's 200 lines and Kete Enterprise's own loop have somewhere to go, and memory,
  long runs and evaluations (steps B4, C6) start from a runtime instead of from nothing.
- Good, because leaving stays small: the runtime is imported by two files of one package.
- Bad, because of the weight (80 MB, 94 packages) in every app that has an agent.
- Bad, because the runtime moves fast: a raise is a task, with its tests, not a routine.
- Bad, because two casts hide what its types do not say; a raise that breaks the AI SDK's models
  would be found by the tests, not by the compiler.
- Bad, because identifiers are unique across the deployment in its tables (a thread's `id` is the
  primary key): the layer names a person `organization/person`, and threads take generated
  identifiers.

### Confirmation

- `packages/agents/tests/runtime.test.ts`: the tools offered are the caller's capabilities and
  nothing else; a gesture is prepared, never done; usage is recorded once, as the agent acting for
  the person; a spent budget calls no model.
- `packages/agents/tests/conversations.test.ts`: every runtime table has row-level security and
  one policy; a conversation is read by its person only, not by a colleague, not by another
  organization with the same identifiers; nothing is read or written outside an organization; no
  organization is left on a connection; the frozen tables are the ones the installed runtime would
  create — a raise that changes them fails this test, and the difference becomes a new migration.
- Lint: no package but `@kete/agents` imports `@mastra/*`.

## More Information

**What would reverse it**: the parts we use leaving Apache 2.0; the runtime dropping the AI SDK's
models; its conversation tables no longer being creatable outside its own initialisation. Leaving
means writing `runtime.ts` and `conversations.ts` again on `ask` and `askStream`; the tables stay
ours.

**Not taken from the runtime**: its server and its studio, its authentication and its agent builder
(`ee/`), its deployers, its channels (`@kete/notify` has ours), its telemetry, and every storage
domain but conversations until a spec asks for it.

**Next**: governance of memory and evaluations (step B4), agents that run for long and wait for a
person (Kete Enterprise, step C6). Each adds its tables through the same pattern: the runtime's
SQL, frozen, with its organization and its policy.

Spec `089-agent-runtime`; decision 0009; doctrine D-043 and D-044.
