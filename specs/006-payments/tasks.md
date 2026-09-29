# Tasks: Payments and subscriptions

## Package `@kete/payments`

- [x] T001 Port, `isPaid`, `sameMoney` (FR-001)
- [x] T002 Chariow adapter: checkout, sale, product, Pulse signature — shapes read from the real API
- [x] T003 Fake provider signing like the real one
- [x] T004 Tests, and a read-only check against the real API (product and a settled sale)

## Compte Kete

- [x] T005 Migration `0002_payments.sql`: `offers` (read-only policy), `checkouts` and `subscriptions` under RLS, `payment_notifications`, definer lookup (FR-002, FR-003)
- [x] T006 `features/payments/billing.ts`: start, confirm, reconcile once, extend from the end, notifications
- [x] T007 `/api/payments/notifications`
- [x] T008 `/espace/abonnements`, nav, tools page access (FR-004)
- [x] T009 Token `apps` claim; `@kete/auth` `canUse` (FR-005)
- [x] T010 `scripts/offers.ts` (FR-006)
- [x] T011 Integration tests on the real database (SC-001)
- [x] T012 e2e: subscriptions page, member view, 375 px

## Staging and the real proof

- [ ] T013 `[blocking]` Author: Pulse in the Chariow dashboard → `…/api/payments/notifications`, events successful, failed and abandoned sale; its signing secret handed over
- [ ] T014 Staging: payment variables, migration `0002`, first offer set from a published product
- [ ] T015 `[blocking]` Author: a real payment on staging opens access (SC-002)
