# Feature Specification: Capabilities and the event catalog

**Feature Branch**: `023-capabilities`
**Created**: 2026-09-30
**Status**: Implemented
**Input**: Doctrine D-030, PRINCIPES (the autonomy scale, "the agent never has more rights than the
person"), ARCHITECTURE §8 (`capability.v1`) — roadmap phase 4. Every Kete product must be ready for
agents: what it lets them do, how far alone, through MCP and the chat, under the same rules as its
screens. Decision 0006 also promised the event catalog in AsyncAPI.

## User Scenarios & Testing

### User Story 1 — A capability says how far an agent may go (P1)

1. **Given** a level 1 capability, **Then** it runs for anyone allowed.
2. **Given** a level 2 capability, **Then** an agent runs its reversible command, journaled, and the
   result names the inverse; declaring level 2 over an irreversible command is refused.
3. **Given** a level 3 capability, **Then** an agent only prepares a draft; a person runs it.
4. **Given** a level 4 capability, **Then** an agent only prepares a draft; a person must also
   confirm explicitly.

### User Story 2 — The same rights everywhere (P1)

1. **Given** a caller, **Then** the capabilities listed, and those invocable, are only those the
   host authorizes; an agent acting for a person gets no more than that person.
2. **Given** an unknown capability, a missing right or an invalid input, **Then** the invocation is
   refused and says why.

### User Story 3 — Through MCP (P1)

1. **Given** an MCP client, **When** it connects to the product's MCP endpoint, **Then** it lists
   only its caller's tools and invokes them through the same registry.
2. **Given** a caller the host does not recognize, **Then** the endpoint answers 401.

### User Story 4 — The event catalog (P2)

1. **Given** the contracts and the SDK's standard events, **Then** an AsyncAPI 3.1 document is
   generated, valid, checked in CI, and shown on the documentation site.

## Requirements

- **FR-001**: The `capability.v1` contract (name in snake_case — a valid tool name for MCP and every
  model provider; autonomy 1–4; reversible; inverse command; permission `resource:action`; input and
  output JSON Schemas); `manifest.v1` may list `capabilities` (optional, additive); the SDK exports
  `Capability` and `validateCapability`.
- **FR-002**: `@kete/capabilities`: `defineCapability`, `createCapabilityRegistry` (`list`,
  `invoke`, `tools`, `describeAll`) over a host giving `authorize` and `transaction`.
- **FR-003**: `createMcpHandler`: a stateless Streamable HTTP endpoint (`WebStandardStreamableHTTPServerTransport`
  of the official SDK) as a `Request → Response` handler — no server framework in the package.
- **FR-004**: `pnpm events:generate` / `events:check` produce `docs/generated/events.asyncapi.json`;
  the site's reference gains an Events page.

## Success Criteria

- **SC-001**: The 12 tests of `capabilities` pass, including the official MCP client against the
  handler; every listed capability validates against `capability.v1`.
- **SC-002**: The AsyncAPI CLI validates the catalog with no governance issue.
