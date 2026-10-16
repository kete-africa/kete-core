# @kete-africa/work

## 0.1.0

### Minor Changes

- Holdings and the relay (spec 111, step U; doctrine D-056). `@kete-africa/work` keeps every thing
  in progress with its holder, never nobody (`sayHolding`, contract `holding.v1`), relays it when its
  holder is away — deputy, manager, head (`relayAbsences`, `handBack`, `reclaimUnheld`) — nudges it
  in working hours when it waits too long (`dueNudges`), lists and closes them (`openHoldings`, `finishHolding`), gathers « Pour moi » (`forMe`) and the
  fluidity figures (`fluidity`). `@kete-africa/sdk` adds `holding.v1` (`Holding`, `validateHolding`).
