# Tasks: The Compte Kete by phone number

- [x] T001 `user.phone_number` (E.164, unique) and `app_sign_in_links` (migration 0006)
- [x] T002 Scope `kete:people`, granted per client through `client_credentials` (`clients create --people`)
- [x] T003 `requireApp`: the app's own token, its scope, the client still granted and enabled
- [x] T004 `POST /api/apps/people`: idempotent by number, organization created with its owner
- [x] T005 `POST /api/apps/sign-in-links`: return address on the app's origins, never for a person
      with a second factor; Better Auth magic link (single attempt, hashed, 10 min), handed back
- [x] T006 `/api/apps/continue`: the link is hers, unused, unexpired → the app's return address
- [x] T007 The number shown in place of the placeholder address; "link expired" notice
- [x] T008 Tests: tokens and refusals, provisioning, single use, origin checks
