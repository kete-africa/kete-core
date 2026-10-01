# Feature Specification: Views in copilots (MCP Apps)

**Feature Branch**: `028-views`
**Created**: 2026-10-01
**Status**: Implemented
**Input**: Doctrine D-037 (a Kete App is also a set of views a copilot shows; MCP Apps; generic and
custom views; the person decides in the view, level 4 in the app). The author's discussion on how
an app shows itself in a copilot. Spec 023 built the MCP endpoint over capabilities, text only.

## User Scenarios & Testing

### User Story 1 — A draft decided in the conversation (P1)

1. **Given** an agent calling a level 3 capability through MCP, **Then** the result carries the
   draft's review and names `ui://kete/review`; the host shows it in the conversation.
2. **Given** the view, **When** the person corrects a value and validates, **Then** the product's
   command runs as from its screen, journaled with her as actor through the `view` channel, and her
   correction is kept.
3. **Given** the decision tools, **Then** they are visible to the view only (`visibility: ["app"]`),
   and an actor that is not a person is refused.
4. **Given** a level 4 draft, **Then** validating in the view answers `open_in_app` with the
   product's screen; refusing works everywhere.

### User Story 2 — Any form, table or record, without interface code (P1)

1. **Given** a capability returning `tableView`, `detailView` or `formView` and naming its view,
   **Then** the generic page draws it, in the product's design, the host's theme and language.

### User Story 3 — A real MCP client can connect (P2)

1. **Given** no token, **Then** the endpoint answers 401 with the address of its protected resource
   metadata (RFC 9728), which names the identity that issues tokens.

## Requirements

- **FR-001**: `capability.v1` gains `view` (`ui://…`); `defineCapability` checks it.
- **FR-002**: `createMcpHandler({ views, draftUrl, resourceMetadataUrl })`: views as resources
  (`text/html;profile=mcp-app`), `_meta.ui.resourceUri` on tools, the three decision tools;
  `protectedResourceMetadata`.
- **FR-003**: `registry.review`, `registry.decide` (validate with corrections, refuse; level 4 needs
  `confirmed`, given only by the product's screen).
- **FR-004**: `@kete/views`: `keteViews`, `tableView`, `detailView`, `formView`, `VIEWS`; one page
  built by Vite (single file), its words in `messages/`.
- **FR-005**: `@kete/design` exports `base.css` (its styles without font files).

## Out of scope

- The host that shows views (Kete Enterprise's copilot) and the registry of apps and their views
  (D-037: `kete-enterprise`).
- Embedded fonts in the page (size); `workspace` uses the system's Segoe UI.

## Success Criteria

- **SC-001**: The capabilities tests (17) pass on the Neon test branch, among them a draft prepared
  through MCP, corrected and validated in its view, journaled through `view`.
- **SC-002**: The views tests (7) pass: the page is self-contained, production-built, and draws each
  view.
- **SC-003** `[blocking]`: with an app of the template on staging (spec 029), a draft appears and is
  decided in Claude's conversation.
