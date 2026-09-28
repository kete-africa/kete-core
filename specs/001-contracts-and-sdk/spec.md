# Feature Specification: Contracts and SDK

**Feature Branch**: `001-contracts-and-sdk`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "Phase 1 of the Kete Core roadmap. Any Kete app can describe itself
(manifest), report its health, and send signed integration events reliably to a receiving service
(Kete Cockpit later), through versioned contracts and a shared SDK. Events are written in the same
transaction as the business change (outbox), delivered in batches with retries, never duplicated
nor lost, and never block a user when the receiver is down. Receivers verify authenticity and
freshness. No business detail leaves the app: facts and counters only."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An app reports what happened, without ever losing it (Priority: P1)

A Kete app (for example Nettio) records a business change — a customer signs up, a payment
succeeds. In the same step, it records an integration event announcing it. Shortly after, the event
reaches the receiving service. If the receiver is unreachable, the app keeps working normally for
its users, keeps the event, and delivers it once the receiver is back.

**Why this priority**: this is the foundation of Kete Cockpit and of every supervision flow. Without
reliable, non-blocking event delivery, nothing downstream can be trusted.

**Independent Test**: in a sample app, perform a business change, then check the event arrives at a
test receiver; repeat while the receiver is down, then bring it back and check the event arrives
exactly once, while the business change itself succeeded immediately.

**Acceptance Scenarios**:

1. **Given** a business change succeeds, **When** it is committed, **Then** its event is recorded
   with it, and neither exists without the other.
2. **Given** a business change fails and is rolled back, **When** the delivery runs, **Then** no event
   for it is ever sent.
3. **Given** the receiver is unreachable, **When** a user performs a business change, **Then** the
   change succeeds without delay and the event waits for delivery.
4. **Given** pending events and a receiver that comes back, **When** delivery resumes, **Then** every
   pending event is delivered, and the receiver ends up with each event exactly once.
5. **Given** the same event is delivered twice (a retry after a lost acknowledgement), **When** the
   receiver processes it, **Then** it is recorded only once.

---

### User Story 2 - A receiver trusts only authentic, fresh events (Priority: P1)

The receiving service accepts an event only if it comes from a known app, carries a valid
signature made with that app's key, and is recent enough. Everything else is refused with a clear,
stable reason.

**Why this priority**: an unauthenticated event stream would let anyone inject false facts into
supervision, briefs and alerts — the opposite of "the truth of the figures".

**Independent Test**: send the test receiver a valid event, a modified event, an event signed with a
wrong key, an event from an unknown app, and a replayed old event; only the first is accepted.

**Acceptance Scenarios**:

1. **Given** a valid signed event from a known app, **When** it is received, **Then** it is accepted.
2. **Given** an event whose content was altered after signing, **When** it is received, **Then** it is
   refused as an invalid signature.
3. **Given** an event signed too long ago, **When** it is received, **Then** it is refused as stale.
4. **Given** an event from an app the receiver does not know, **When** it is received, **Then** it is
   refused as unknown.
5. **Given** an app rotating its signing key, **When** events signed with the old or the new key
   arrive during the overlap period, **Then** both are accepted, and only the new key after it.

---

### User Story 3 - An app describes itself and its health in a standard way (Priority: P2)

Any supervisor can ask an app who it is (name, version, environment, events it emits) and whether
it is healthy (itself and its dependencies, such as its database), in the same format for every
Kete app.

**Why this priority**: health checks and version tracking are the second pillar of supervision;
they depend on the same contracts but not on event delivery.

**Independent Test**: query a sample app's description and health; check both follow the published
contracts; make its database unreachable and check the health reports it as degraded.

**Acceptance Scenarios**:

1. **Given** a running app, **When** its description is requested, **Then** it returns its identity,
   version, environment and the list of event types it emits, valid against the manifest contract.
2. **Given** a healthy app, **When** its health is requested, **Then** it reports "healthy" with each
   dependency's state.
3. **Given** a dependency is down, **When** health is requested, **Then** it reports "degraded" or
   "down" and names the failing dependency, without exposing secrets or internal details.

---

### User Story 4 - A new app adopts the contracts quickly (Priority: P3)

A developer or an agent brings an existing app (or a new one) to Kete: it adds the SDK, declares
its identity and events, and sends its first verified event, following the package documentation
and its diagrams.

**Why this priority**: adoption cost decides whether Firmo, Nettio and Nyatefe actually join; it
matters once the mechanisms work.

**Independent Test**: starting from a minimal app without the SDK, follow the documentation and time
until the first event is accepted by the test receiver.

**Acceptance Scenarios**:

1. **Given** the package documentation, **When** a developer follows it on a minimal app, **Then**
   the first verified event is accepted without reading the SDK source.
2. **Given** an event type not declared in the app's manifest, **When** the app tries to record it,
   **Then** it is refused before leaving the app.

---

### Edge Cases

- **Clock skew** between app and receiver: a tolerance window applies; events outside it are refused
  as stale, with the reason stated.
- **Receiver down for days**: pending events are kept; the app's health reports a growing delivery
  backlog so supervision can raise an alert.
- **A batch partly refused**: accepted events are acknowledged; refused ones are marked with their
  reason and not retried forever.
- **Oversized or malformed event**: refused before leaving the app, with a validation error.
- **Personal or business detail in an event**: the contracts carry only facts and counters; free-form
  personal data fields are not allowed.
- **Ordering**: events are not guaranteed to arrive in order; each carries its occurrence time and an
  identifier, so a receiver can order them.
- **Contract evolution**: adding an optional field keeps version 1 valid; removing or changing a
  field requires a new major version, and receivers keep accepting the previous one during a
  transition.

## Requirements *(mandatory)*

### Functional Requirements

**Contracts**

- **FR-001**: The system MUST publish three versioned contracts: the app **manifest**, the
  integration **event** envelope, and the **health** report.
- **FR-002**: Each contract MUST be machine-readable and validate real payloads; the SDK's types MUST
  be derived from the contracts, never written separately.
- **FR-003**: A contract change MUST follow versioning rules: additive changes within a major
  version, breaking changes only in a new major version.

**Events**

- **FR-004**: An event MUST carry a unique identifier, its type, its contract version, the emitting
  app, a pseudonymous reference to the customer organization, its occurrence time, and a data
  payload restricted to facts and counters.
- **FR-005**: The standard event types MUST include: account created, account activated, payment
  succeeded, payment failed, subscription renewal due, account closed, and a daily metrics summary.
- **FR-006**: An app MUST record an event in the same atomic step as the business change it
  announces.
- **FR-007**: Recording an event MUST NOT depend on the receiver being reachable, and MUST NOT slow
  down the business change noticeably.
- **FR-008**: Pending events MUST be delivered in batches, retried with increasing delays, and kept
  until acknowledged or definitively refused.
- **FR-009**: Each delivery MUST be signed with the emitting app's key and timestamped.
- **FR-010**: An app MUST refuse, before sending, any event type absent from its manifest and any
  payload invalid against the contract.

**Receiving**

- **FR-011**: A receiver MUST be able to verify, with the SDK, the signature, the freshness and the
  emitting app of a delivery.
- **FR-012**: A receiver MUST process each event identifier at most once.
- **FR-013**: Refusals MUST use stable, documented reason codes (invalid signature, stale, unknown
  app, invalid payload, undeclared type).
- **FR-014**: Signing keys MUST support rotation with an overlap period.

**Description and health**

- **FR-015**: An app MUST expose its manifest and its health report in the contract formats.
- **FR-016**: The health report MUST include each critical dependency's state and the size of the
  pending delivery backlog, and MUST NOT expose secrets.

**Documentation**

- **FR-017**: Each contract and package MUST ship with documentation in English and diagrams (event
  lifecycle, delivery sequence), updated with the code.

### Key Entities

- **App (product)**: a Kete app known to the receiver; has an identifier, a name, environments, and
  one or more signing keys.
- **Signing key**: a secret shared between one app and the receiver; has a validity period for
  rotation.
- **Integration event**: an immutable fact announced by an app, in the event envelope.
- **Outbox entry**: an event waiting in the app for delivery, with its attempts and status (pending,
  delivered, refused).
- **Delivery**: one signed batch sent to the receiver, with its outcome per event.
- **Manifest**: an app's self-description.
- **Health report**: an app's current state and its dependencies' states.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across 1,000 business changes with random receiver outages and delivery failures, the
  receiver ends with exactly 1,000 events: zero lost, zero duplicated.
- **SC-002**: When the receiver is reachable, 95% of events are accepted within 60 seconds of the
  business change.
- **SC-003**: 100% of altered, wrongly signed, unknown-app and stale deliveries are refused, each with
  its documented reason code.
- **SC-004**: With the receiver unreachable, the business change's response time increases by less
  than 10%.
- **SC-005**: Starting from a minimal app, a developer following only the documentation obtains a
  first accepted event in under 30 minutes.
- **SC-006**: A dependency failure is reflected in the health report within one check.

## Assumptions

- The first receiver is a **test receiver** shipped for proof; Kete Cockpit will use the same
  verification later (its own repository).
- Apps are TypeScript apps using Postgres (doctrine D-016); a Python SDK is out of scope until a
  Python app needs it.
- Signing uses a secret shared per app (keyed-hash signatures), as decided in the doctrine; a public
  key scheme is not needed for a receiver operated by Kete.
- The customer organization is referenced by an opaque identifier; no names, e-mails or phone
  numbers travel in events.
- Delivery is at-least-once from the app, made exactly-once at the receiver by identifier.
- The freshness tolerance defaults to five minutes, adjustable per receiver.
