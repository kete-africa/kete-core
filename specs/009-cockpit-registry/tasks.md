# Tasks: Kete Cockpit V0.2 — the app registry

- [x] T001 Neon project `kete-cockpit`, branches `main`/`dev`/`test`; `cockpit_app` recreated in SQL without BYPASSRLS; decision 0004 (FR-001)
- [x] T002 Schema and migration `0000_registry.sql`: `apps`, `app_keys`, `probes`, `kete_received_events`
- [x] T003 Secrets sealed with AES-256-GCM (`COCKPIT_ENCRYPTION_KEY`) (FR-002)
- [x] T004 `registerApp` from the manifest; refusals named (FR-002)
- [x] T005 `probeApp`, `probeAll`, scheduled with an advisory lock (FR-003)
- [x] T006 `/api/events` with the SDK receiver, key ring and declared types read per delivery; key rotation with a week of overlap (FR-004)
- [x] T007 Screens `/apps`, `/apps/$appId` (FR-005)
- [x] T008 Integration tests on the real database with a witness app (SC-002)
- [x] T009 e2e: the Compte Kete registered, healthy, an event received, a forgery refused (SC-001)
- [x] T010 CI: cockpit migrations and tests on the `test` branch
- [ ] T011 Staging with Coolify (see `docs/OPERATIONS.md`)
