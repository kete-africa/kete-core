# @kete-africa/tenancy

## 0.1.1

### Patch Changes

- Follows the new versions of `@kete-africa/commands` and `@kete-africa/sdk`: a package pins the
  exact versions of its `@kete-africa` dependencies when it is published, so an app never gets two
  copies of the command journal.

## 0.1.0

### Minor Changes

- cfd674a: First release: the organization as the hard boundary — `inOrganization`, `organizationPolicySql`,
  `auditRls`, `assertRoleIsolated`, and the Drizzle helpers `organizationIsolation` and
  `inOrganizationTx` (`@kete/tenancy/drizzle`).
- 0dce116: `sqlExecutorOf` (`@kete/tenancy/drizzle`): a Drizzle database or transaction as the `SqlExecutor`
  every Kete package takes.
