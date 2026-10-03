# @kete-africa/center

## 0.3.0

### Minor Changes

- bead1c9: The app contract, part 2 (spec 049): an app's own token for its center (`createAppToken`,
  `createAppTokenVerifier`, scope `kete:center`); named outboxes and a token transport, so business
  events reach the center without a shared key; the directory in `@kete/center`; the template
  announces `task.created` and `task.completed`.
- fe88e80: The app contract, part 4 (spec 049): `requestDecision` asks the center's circuits for the person;
  `decision` reads the outcome with the app's own token.

## 0.2.0

### Minor Changes

- aa87c98: The app contract (spec 049): an app declares its permissions with their words and default roles,
  the classification of its capabilities and data sets, the events it emits, the subjects it asks
  decisions for and its client id. `@kete/center` reads a person's grants at Kete Enterprise;
  `createRights` follows them once the organization manages the app's rights.
