# Spec 108 — The frame and Kete Intelligence of the validated canvas

The frame of every signed-in screen and Kete Intelligence's drawer, built as the validated canvas
v3.1 draws them (`docs/ROADMAP.md`, phase 9; doctrine D-042, D-045, D-050 to D-054). Spec 100
assembled the frame from `Shell` and spec 101 drew the drawer its own way. Both drifted from the
canvas the person validated, so every Kete product wore a frame she had not approved.

## Why

The canvas is the interface the person approved, screen by screen, on a computer and a phone, light
and dark. A product that wears something close to it is not that interface. The frame and the drawer
are on every screen of the center and of every app, so they are built once, here, to the canvas, and
compared with it before they ship.

```mermaid
flowchart TB
  C[canvas v3.1 · validated] -->|measured, compared| D[@kete/design · CanvasFrame, Frame*, CanvasIcon, VerificationCard]
  D --> S[@kete/shell · AppFrame]
  D --> I[@kete/intelligence · IntelligencePanel]
  S --> P[the center and every app]
  I --> P
  P -->|screenshots beside the canvas| C
```

## Requirements

- **FR-001 — The frame** (`@kete/design` `CanvasFrame`, `@kete/shell` `AppFrame`), as the canvas
  draws it:
  - a top bar across the whole width, 54 px high: the burger below 1000 px, Kete's mark and name,
    her organization, the search (Ctrl K) in the middle, the sync, « Noter », « Demander » with its
    spark, « Fichiers », the bell with its count, her avatar with her name, the appearance and
    sign-out;
  - the places on the left, 262 px wide:
    - the center's main places, or an app's head (its mark in its color, its question, « Retour au
      centre ») over its sections;
    - each place with what waits in it: a count, « 2 à lire » in bold, a spinner while an agent
      works; a project's square in place of an icon;
    - the foot: the apps of her organization, folded, then « Catalogue de prix », « Réglages » or
      « Administration »;
  - the drawer on the right, 440 px wide, or wider;
  - below 1000 px, the places and the drawer slide over the page;
  - below 640 px, five tabs at the bottom — three places, « Demander » raised in the middle (the
    page « Demander » when `askHref` is given), « Menu » last — and the search, « Demander » and the
    organization leave the top bar.
- **FR-002 — The page** (`FramePage`, `FramePageHead`, `FrameSource`): centered, 1114 px wide or
  1384 px; a head with where it sits, its 34 px title, its question, its actions. Its spacing follows
  the frame's width (container queries), not the window's. `KpiGrid` fills the width with as many
  tiles as fit; `KpiTile` is the canvas's.
- **FR-003 — The drawer** (`IntelligencePanel`):
  - its head: « Demander » and « Fichiers », the threads, a new thread, wider, close;
  - the page she asks from as a chip she may remove, and how far it looks (« Dans tout Kete »,
    « Dans cette app »);
  - the greeting stays at the top of the thread;
  - each answer shows:
    - its seconds and what it does now;
    - its plan, checked as it goes;
    - each capability with its level (level 3 and above in the agent's color). Opened, it shows what
      it was called with (→) and what it found (←);
    - the draft as its verification card, then its words and its sources;
    - « Copier », « Régénérer » and « N étapes · N gestes · N s »;
  - the suggestions wait above the field whenever it is not answering;
  - a capability shows its technical name in mono, as the canvas draws it; the line « what it does
    now » says it in her words;
  - what a product adds beyond the contract (a table, an app's view) shows after the words
    (`renderAfter`);
  - the field joins files (shown as chips), cites an object after @ and asks a gesture after /,
    both picked from the product's lists, writes her voice as she speaks, and says « Arrêter » while
    it answers.
- **FR-004 — The verification card** (`VerificationCard`):
  - a raised head with its mark, its title and « une personne valide »;
  - each field with its provenance, the uncertain ones in the verify color with an alert;
  - the gestures in its foot, and the lesson a correction becomes.
  - `Button` gains the canvas's `ghost`.
- **FR-005 — The icons** (`CanvasIcon`): the canvas's own drawings, generated from it.
- Every word through props, from the product's catalogs. `Shell` stays Compte Kete's frame (spec
  046).

## Proof

- `packages/shell/tests/shell.test.tsx` and `packages/intelligence/tests/intelligence.test.tsx`: the
  frame's places, tabs and words; the drawer's head, the → ← lines of a capability, the level-3
  badge, the context, the suggestions, a failure in words.
- Screenshots of the design preview (« cadre · clair », « cadre · sombre ») beside the canvas's
  Kete Finance, at 1440 px and 390 px, the drawer closed, open, and after « Prépare la facture
  d'acompte de 30 % du devis D-2026-0004 »: the same frame, the same drawer, the same card. They are
  kept in `screens/`, each `*-kete.jpg` beside its `*-canvas.jpg`.

What still differs from the canvas, on purpose:

- On a touch screen, buttons are 44 px high, where the canvas draws 33 px: the workspace design's
  rule for a thumb (spec 106).
- The design preview has no page « Demander », so its phone tab opens the drawer; an app gives
  `askHref` and its tab opens the page, as the canvas does.
- An answer's words stream as Markdown: a mark not yet closed (`**`) shows until its end arrives.

## What stays for later

The center's and the apps' own pages are redone to the canvas in their own steps: Décider (Matin,
Soir, Semaine), Planifier, Mon tableau, Demander, Déléguer and the project in Kete Enterprise; Kete
Finance, Team, Commitments and Support.
