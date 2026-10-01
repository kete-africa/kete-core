# @kete-africa/tenancy

## 0.1.0

### Minor Changes

- cfd674a: First release: the organization as the hard boundary — `inOrganization`, `organizationPolicySql`,
  `auditRls`, `assertRoleIsolated`, and the Drizzle helpers `organizationIsolation` and
  `inOrganizationTx` (`@kete/tenancy/drizzle`).
- 0dce116: `sqlExecutorOf` (`@kete/tenancy/drizzle`): a Drizzle database or transaction as the `SqlExecutor`
  every Kete package takes.
