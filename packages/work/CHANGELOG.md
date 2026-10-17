# @kete-africa/work

## 0.2.2

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.2.1

### Patch Changes

- Published on `@kete/sdk` with the deployment events (spec 123), so an app upgrading the SDK keeps
  one copy of it.

## 0.2.0

### Minor Changes

- b1ab69b: The apps on the living model (spec 114): `holding.v1` carries where a holding opens; `@kete/work`
  keeps a source in step (`syncSource`) and stores the link (`workLinksMigrationSql`); `@kete/center`
  says an app's holdings (`sayHoldings`) and passes its gestures through the organization's policies
  (`checkGesture`); a new app says its holdings after each gesture and every minute.

## 0.1.3

### Patch Changes

- Published against the sdk of this release, so that a product meets one copy of the contracts.

## 0.1.2

### Patch Changes

- Published against the sdk of this release, so that a product meets one copy of the contracts.

## 0.1.1

### Patch Changes

- Built against `@kete-africa/sdk` 0.11.0: a product reading dated facts with the sdk 0.11 (for
  `holding.v1`) and passing them to `@kete-africa/time` now meets one `DatedFact` type, not two.

## 0.1.0

### Minor Changes

- Holdings and the relay (spec 111, step U; doctrine D-056). `@kete-africa/work` keeps every thing
  in progress with its holder, never nobody (`sayHolding`, contract `holding.v1`), relays it when its
  holder is away — deputy, manager, head (`relayAbsences`, `handBack`, `reclaimUnheld`) — nudges it
  in working hours when it waits too long (`dueNudges`), lists and closes them (`openHoldings`, `finishHolding`), gathers « Pour moi » (`forMe`) and the
  fluidity figures (`fluidity`). `@kete-africa/sdk` adds `holding.v1` (`Holding`, `validateHolding`).
