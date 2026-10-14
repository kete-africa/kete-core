# @kete-africa/shell

## 0.2.0

### Minor Changes

- The phone (spec 106, step L8). `@kete-africa/shell` adds the morning's pile (`MorningPile`), the
  field mode « Terrain » (`FieldFrame`) and `useSunlight`. `@kete-africa/design` generates « Plein
  soleil » for every design — `data-sun="on"`, the light mode at its strongest, its contrasts checked.
- `onNote` may return what to show under the note's field — « Gardée ; rappel jeudi 9 h », with its
  undo — and the dialog stays open; nothing returned closes it, as before.

## 0.1.0

### Minor Changes

- The shell (spec 100): `@kete-africa/shell` draws the frame every Kete product wears from the app's manifest — places, Ctrl K, « Demander » beside the page, « Noter », the state of synchronization, the phone's tabs. `@kete-africa/design` gains `DecisionCard`, `Mention`, `AgentRunState` and « Pourquoi ? » under a `KpiTile`; Ctrl K always offers to ask the words typed. The template wears the shell.
