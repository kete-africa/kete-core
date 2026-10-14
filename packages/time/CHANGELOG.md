# @kete-africa/time

## 0.2.0

### Minor Changes

- The lifecycle (spec 105, step L7). `@kete-africa/lifecycle` keeps skills, agents and apps with
  their owner, version, tier and test cases, and the lessons their use taught — gathered with
  consent, kept as test cases or dropped by their owner — promoted one tier at a time with a review by
  their risk (`/server`); and, pure, an agent's six states, budget, triggers and autonomy earned by
  proofs. `@kete-africa/time` now holds routines (`nextRun`), which `@kete-africa/boards` re-exports.
  `@kete-africa/design` adds `AgentCard`, `LessonCard` and `TierLadder`.

## 0.1.0

### Minor Changes

- The time of the organization (spec 102, step L4). `@kete-africa/time` computes when dated facts
  happen (`occurrences`, `placeInDays`), what clashes (`conflicts`: expected while away, two places
  at once), a person's free time (`freeSlots`) and blocks for her tasks before their day
  (`proposeBlocks`, on the half hour); `icsAgenda` reads her own agenda as « busy » facts.
  `@kete-africa/center` says an app's dated facts (`sendDatedFact`, `dropDatedFact`).
  `@kete-africa/design` draws them: `WeekCalendar`, `AgendaList`, `TeamLanes`.
