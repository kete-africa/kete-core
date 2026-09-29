# Tasks: The Compte Kete announces its events

- [x] T001 Migration `0005_outbox.sql` from `outboxMigrationSql` (FR-001)
- [x] T002 `platform/events.ts`: declared events, Drizzle transaction as the SDK's `SqlExecutor`, `record`, relay (FR-003)
- [x] T003 `account.created` after an organization is created
- [x] T004 `payment.succeeded` in the reconciliation transaction, amounts in minor units
- [x] T005 Manifest declares the events; `/health` reports the backlog (FR-002)
- [x] T006 Tests: events recorded once, none for a failed payment, delivered signed and marked delivered (SC-001)
- [ ] T007 Staging: register the Compte Kete in the Cockpit, give it `KETE_EVENTS_*`
