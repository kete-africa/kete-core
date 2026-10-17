# @kete-africa/infrastructure

## 0.1.0

### Minor Changes

- The provisioning port (spec 121; phase 11, step B1): `Databases` and `Hosting`, an instance
  created step by step until it answers and destroyed through the port alone, undone the latest
  first when a step fails; the Neon and Coolify adapters (moved from the factory, with their
  destruction and the app's state) and the port in memory.
