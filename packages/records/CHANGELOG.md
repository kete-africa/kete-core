# @kete-africa/records

## 0.1.1

### Patch Changes

- Follows the new versions of `@kete-africa/commands` and `@kete-africa/sdk`: a package pins the
  exact versions of its `@kete-africa` dependencies when it is published, so an app never gets two
  copies of the command journal.

## 0.1.0

### Minor Changes

- 0dce116: First release: one Zod schema per record with field metadata (label, personal, to verify), the
  record lifecycle, prefixed time-ordered identifiers, and money as integers with their currency.
