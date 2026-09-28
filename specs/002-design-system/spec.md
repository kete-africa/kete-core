# Feature Specification: Design system v1 rectangle

**Feature Branch**: `002-design-system`
**Created**: 2026-09-28
**Status**: Implemented
**Input**: Roadmap phase 2 — "`@kete/design`: the v1 rectangle design system and its `DESIGN.md`
(Google DESIGN.md format), kept in sync with the tokens and linted in CI" (doctrine D-010).

## User Scenarios & Testing

### User Story 1 — One source of truth for every Kete screen (P1)

An agent or a person designing a Kete screen reads one document that holds the tokens and the
reasons behind them, and the styles of every app follow it without drift.

**Acceptance Scenarios**:
1. **Given** `DESIGN.md`, **When** it is linted, **Then** it has no error and no warning (contrast
   included).
2. **Given** a change to a token, **When** the theme is not regenerated, **Then** CI fails.

### User Story 2 — Apps start from correct building blocks (P1)

An app gets the brand, fonts, base rules and the first accessible components (mark, kete band,
button, tag, text field, panel) by importing one package.

**Acceptance Scenarios**:
1. **Given** a button, **Then** it never submits a form by accident.
2. **Given** a state tag, **Then** it carries a word and a square marker, and an error is never in
   the brand red.
3. **Given** a text field with an error, **Then** the label, the input and the error are associated
   for assistive technologies.

## Requirements

- **FR-001**: `DESIGN.md` MUST hold all v1 tokens (colors including night theme and states,
  typography, radii, spacing, components) and the rationale sections in the canonical order.
- **FR-002**: The Tailwind 4 theme MUST be generated from `DESIGN.md` and checked in CI.
- **FR-003**: Fonts MUST be self-hosted.
- **FR-004**: Components MUST be accessible as drawn (real buttons, associated labels, decorative
  marks hidden from assistive technologies).

## Success Criteria

- **SC-001**: `DESIGN.md` lints with 0 errors and 0 warnings.
- **SC-002**: A theme drift fails CI.
- **SC-003**: Every class used by the components exists in the compiled theme.
- **SC-004** *(blocking, human)*: the author validates the first real screens (Mon espace Kete)
  against `DESIGN.md` — in feature 003.
