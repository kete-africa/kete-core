# Spec 100 — The shell

Step **L2** of phase 9 (`docs/ROADMAP.md`; doctrine D-042, D-045, D-050 to D-054): the frame every
Kete product wears, built once from the app's manifest, and the canvas's first wave of parts.

## Why

Each app drew its own header with its own links — Kete Finance's showed five links in a row, and
« Demander » as a page among them — while Kete Enterprise had a richer frame of its own. A person
going from the center to an app changed products. The canvas the author validated asks for one
frame: the places of the app, Ctrl K to go, find or ask, « Demander » beside the page, « Noter »
from anywhere, the state of synchronization, the phone's tabs.

```mermaid
flowchart LR
  K[kete.json · places, question] --> P[placesFor · her language, her permissions]
  P --> F[@kete/shell · AppFrame]
  D[@kete/design · Shell, NavItem, CommandPalette, TabBar] --> F
  F --> A[the template, then every app]
  F --> C[Kete Enterprise, step C1]
  N[@kete/design · DecisionCard, Mention, AgentRunState, KpiTile why] --> A & C
```

## Requirements

- **FR-001 — Places from the manifest**: `placesFor` turns the manifest's places into sections in
  the person's language and the manifest's order; a place behind a permission shows only to who
  holds it.
- **FR-002 — One frame, `AppFrame`**: the sidebar of the places with what waits in each; Ctrl K with
  the places, what the product finds under her rights, and the question she typed; « Demander »
  (Ctrl J) opening the drawer beside the page; « Fichiers »; « Noter » (N, when she is not typing)
  with its dialog; the bell; the state of synchronization (up to date, offline with what waits,
  sending); her name, her mode and the way out; on a phone, up to four places on the tabs with
  « Demander » raised in the middle, and no second « Demander » in the toolbar.
- **FR-003 — No word in the package**: every word comes through `ShellWords`, from the product's
  catalogs.
- **FR-004 — The first wave of parts** in `@kete/design`: `DecisionCard` (a decision with its amount,
  who asks, its evidence, what it changes, its gestures and « Comment ? »), `Mention` (an object
  named anywhere, with its card and the color of its app), `AgentRunState` (an agent's six states),
  and « Pourquoi ? » under a `KpiTile`.
- **FR-005 — Ctrl K always offers to ask** the words typed, even when no place matches.
- **FR-006 — The template wears it**: its manifest declares its question and places; `AppShell` is
  the shell; a question from Ctrl K or the frame reaches « Demander » (until step L3 replaces that
  page by the drawer).

## Proof

- `packages/shell/tests/shell.test.tsx` (5): the places keep the manifest's order and headings in
  her language; a place behind a permission is shown only to who holds it; the frame draws the
  sidebar, Ctrl K, « Demander », « Noter », « Fichiers », the bell, the state of synchronization and
  the phone's tabs; what the product does not offer is left out; the pill says where the gestures
  stand.
- `packages/design/tests/canvas.test.tsx` (4): a decision with its evidence and gestures; a mention
  with its card in its app's color; the six states; « Pourquoi ? » under a figure, never inside a
  link — all with semantic tokens only.
- The template builds and its tests pass (24); the design preview's « cadre » page shows the frame
  in both modes, Ctrl K asking the words typed and the drawer opening, the tabs on a phone.

## What stays for later

The drawer's content (L3), the files (with the index of the center), the economy mode (L8).
