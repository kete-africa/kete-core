# @kete-africa/money

## 0.1.1

### Patch Changes

- Every package published again together, so each one pins the current versions of the others: an app
  installs one copy of `@kete-africa/capabilities`, `@kete-africa/commands` and `@kete-africa/sdk`; some
  packages had kept the versions of the day they were last published.

## 0.1.0

### Minor Changes

- A new package for the apps that count money: an amount is an integer of its currency's smallest
  unit — read exactly, added and taxed with one rounding, split without losing a unit, shown in a
  person's language.
