# @kete-africa/infrastructure

## 0.1.1

### Patch Changes

- 5855468: Proven on Kete's Neon and Coolify (spec 121): the Coolify adapter serves a host the port gives as
  an `https://` address; the Neon adapter's destruction takes the application role's privileges
  before dropping it (PostgreSQL 16), waits for Neon to apply the database's removal before the
  owner's, and never connects to a database already gone.

## 0.1.0

### Minor Changes

- The provisioning port (spec 121; phase 11, step B1): `Databases` and `Hosting`, an instance
  created step by step until it answers and destroyed through the port alone, undone the latest
  first when a step fails; the Neon and Coolify adapters (moved from the factory, with their
  destruction and the app's state) and the port in memory.
