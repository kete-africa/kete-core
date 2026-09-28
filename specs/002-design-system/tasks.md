# Tasks: Design system v1 rectangle

- [x] T001 Write `packages/design/DESIGN.md` with every v1 token and the canonical sections (FR-001)
- [x] T002 Lint with `@google/design.md`: 0 errors, 0 warnings (SC-001)
- [x] T003 `tooling/scripts/design-generate.ts`: lint, export the Tailwind 4 theme, `--check` mode; wired into `pnpm check` (FR-002, SC-002)
- [x] T004 `styles.css`: self-hosted fonts, base rules, focus ring, night theme (FR-003)
- [x] T005 Components `KeteMark`, `KeteBand`, `Button`, `Tag`, `TextField`, `Panel` (FR-004)
- [x] T006 Render tests for accessibility (FR-004)
- [x] T007 Verify every component class compiles with Tailwind 4 and the generated theme (SC-003) — checked once with the Tailwind CLI; the Compte Kete app build keeps it checked
- [x] T008 `packages/design/README.md` with the generation diagram
- [ ] T009 Author validation of the first screens (SC-004) — in feature 003
