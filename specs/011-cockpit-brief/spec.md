# Feature Specification: Kete Cockpit V0.3 — the morning brief, alerts and agent access

**Feature Branch**: `011-cockpit-brief`
**Created**: 2026-09-29
**Status**: Parked — after Firmo reaches staging (the doctrine proof needs a real app)
**Input**: Doctrine step 1 proof: "an event from the app in production appears in the next
morning's brief; a simulated outage raises an alert; the agent answers about the apps' state."

## User Scenarios & Testing

### User Story 1 — The morning brief (P1)

Every morning, operators get one short brief: each app's health, what happened yesterday
(accounts created, payments and their amounts, events per type), and what needs attention.

**Acceptance Scenarios**:

1. **Given** events received yesterday, **Then** the brief counts them per app and type, and sums
   payments per currency.
2. **Given** an app that was down or unreachable yesterday, **Then** the brief says so first.
3. **Given** the brief is due, **Then** it is written once per day (idempotent), readable in the
   Cockpit, and sent through the notification channel when one is configured.

### User Story 2 — An alert when an app goes down (P1)

**Acceptance Scenarios**:

1. **Given** an app that was healthy, **When** a reading finds it down or unreachable, **Then** an
   alert goes out once; **when** it is back, a recovery notice goes out once.

### User Story 3 — An agent answers about the apps (P2)

**Acceptance Scenarios**:

1. **Given** an operator's agent connected to the Cockpit's MCP server with the operator's token,
   **Then** it can read the apps, their health, recent events and the latest brief — and nothing
   else; it cannot change anything.

## Requirements

- **FR-001**: Daily snapshots per app (events per type, payment totals per currency, worst health
  of the day), computed from received events and readings.
- **FR-002**: A brief per day, stored, shown on `/brief`; French by default.
- **FR-003**: A notification port with a Telegram adapter (`KETE_TELEGRAM_BOT_TOKEN`,
  `KETE_TELEGRAM_CHAT_ID`) and a log adapter when unset.
- **FR-004**: Alerts on health transitions (to down/unreachable, and back), sent once.
- **FR-005**: Read-only MCP tools (list apps, app health, recent events, latest brief) behind the
  operator's Compte Kete token.

## Success Criteria

- **SC-001**: In tests, an event received yesterday appears in the brief; a simulated outage sends
  one alert and one recovery notice.
- **SC-002** _(human)_: the author receives the brief on Telegram (the bot is created by the author
  with BotFather).
