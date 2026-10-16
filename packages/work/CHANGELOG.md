# @kete-africa/work

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
