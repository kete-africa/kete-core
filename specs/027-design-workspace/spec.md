# Feature Specification: Two designs in three layers, the doctrine's components, client brands

**Feature Branch**: `027-design-workspace`
**Created**: 2026-09-30
**Status**: Implemented
**Input**: Doctrine D-035 (two designs, `kete` and `workspace`, plus each client's brand; three
layers; one DESIGN.md per design checked in CI), CONCEPTION 12 (the doctrine's components provided
to every product), MARQUE (the verification card, the agent states). `@kete/design` had one design,
whose components named its palette directly.

## User Scenarios & Testing

### User Story 0 — The workspace is copilot-demo's system (P1)

1. **Given** the author's `copilot-demo` workspace, **Then** the `workspace` design reproduces its
   system value for value: dark first (#282828 page, #242424 sidebar and cards, #494949 lines,
   #DEDEDE and #999 text), a 262 px sidebar (230 px under 1,100 px, a panel under 760 px), 34 px
   navigation items, 12 px section labels, a 54 px toolbar, a 34/42 px page title 51 px above the
   apps, 66 px app cards with 5 px corners beside a featured one over two rows, 43 px pills with
   24 px corners, menus (7 px) and dialogs (10 px, 32 px padding, 440 px), the client's green to
   guide and its orange for the focus, Segoe UI at 14 px.
2. **Given** the preview at 1,440 × 900, **Then** its sizes and positions measure as the demo's.
3. Two deliberate differences: the primary button's fill is the demo's darker green (#177969),
   since white on #1CA18C reads at 3.2:1; no third-party name, logo or app icon, and Segoe UI is
   named, never shipped (Inter, free, elsewhere).

### User Story 1 — Two designs, one set of components (P1)

1. **Given** `<html data-design="workspace">`, **Then** every component wears the workspace design;
   without it, the `kete` design, unchanged for the Compte Kete and the Kete Apps.
2. **Given** no `data-theme`, **Then** each design has its default mode (`kete` light, `workspace`
   dark); **given** `light`, `dark` (or `night`), or `auto`, **then** both follow it.
3. **Given** a component, **Then** it uses semantic tokens only: a test fails on any base color.

### User Story 2 — Contrasts that hold (P1)

1. **Given** `pnpm design:check`, **Then** it fails when a DESIGN.md has a lint warning, when a
   semantic pair misses its contrast in either mode (4.5:1 for text, 3:1 for what identifies a
   control or the focus), or when a generated file is out of date.

### User Story 3 — A client's brand (P1)

1. **Given** a client's accent that holds its contrasts, **When** `defineBrand` then `brandCss`,
   **Then** pages with `data-brand` wear it in both modes, the text on it chosen to read.
2. **Given** an accent that misses a contrast, **Then** it is refused, with each failing pair and
   its ratio.

### User Story 4 — The doctrine's components (P1)

1. The verification card (each field with its provenance, uncertain fields to be checked, the trace
   of the decision), the agent states (empty square: prepared; filled: a person decided), the
   confirmation of the irreversible (a named modal dialog), the notification with undo (a status),
   the empty page (the seed).

## Requirements

- **FR-001**: `designs/kete/DESIGN.md` (moved, with its dark states) and
  `designs/workspace/DESIGN.md` (copilot-demo's values, dark first, plus a light mode), each linted
  without warning and exported as W3C Design Tokens.
- **FR-002**: `src/semantic.ts`: the semantic colors, fonts, corners, sizes, focus offset and
  label style, mapped per design and mode, with each design's default mode; the contrast pairs.
- **FR-003**: `pnpm design:generate` → `theme.gen.css` (kete utilities), `semantic.gen.css`,
  `src/designs.gen.ts`, `designs/*/tokens.gen.json`.
- **FR-004**: Components on semantic tokens: `Button`, `TextField`, `Tag`, `Panel`,
  `IconButton`, `Dialog`, `VerificationCard`, `AgentState`, `ConfirmDialog`, `UndoNotice`,
  `EmptyState`, `Shell`, `NavSection`, `NavItem`, `Icon`, `PageTitle`, `PageSection`, `AppGrid`,
  `AppCard`, `Chip`, `ChipGroup`, `Menu`, `SearchField`, `Swatches`. Every word through props.
- **FR-005**: `defineBrand`, `brandCss`, `BrandContrastError`, `contrastRatio`.
- **FR-006**: `examples/design-preview`: the demo's page rebuilt with these components; both
  designs and a brand, both modes, one page at a time.

## Out of scope

- The Cockpit's design (D-035 leaves it open).
- Moving the Compte Kete's own screens from base utilities (`bg-sand`) to semantic ones: they stay
  on the `kete` design, which is unchanged.
- The kete field border (`rule-strong` on `paper`, 2.4:1) is not in the checked pairs: a field is
  identified by its label; raising it is a visual change for its own decision.

## Success Criteria

- **SC-001**: Both designs meet every contrast pair in both modes, in CI.
- **SC-002**: A client brand is applied, and a failing one refused, in tests.
- **SC-003**: The preview measures as the demo at 1,440 × 900 (sidebar 262 px, items 34 px, title at
  66 px, first card at 159 px, cards 190 × 66, featured 250 × 144, pills 43 px, toolbar button 33
  px, dialog 440 px) and works at 375 px (the sidebar opens from the toolbar, Escape closes it).
- **SC-004**: The Compte Kete and the Cockpit build and pass their tests unchanged.
