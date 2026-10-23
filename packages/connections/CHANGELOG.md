# @kete-africa/connections

## 0.1.7

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.1.6

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.1.5

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.1.4

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.1.3

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.1.2

### Patch Changes

- Published again on the current versions of the packages it depends on.

## 0.1.1

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.1.0

### Minor Changes

- Connections (spec 119; phase 11, step B1): the tools an organization connects, by a key or by
  OAuth (authorization code with PKCE, refresh — on `oauth4webapi`); credentials sealed with
  AES-256-GCM, never returned by a reading, opened server-side for the call they serve; health
  (`recordCheck`), revocation that wipes the credential; `kete_connections` with its RLS policy
  and an append-only journal.
