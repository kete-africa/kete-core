# @kete-africa/ai

## 0.1.1

### Patch Changes

- Follows the new versions of `@kete-africa/commands` and `@kete-africa/sdk`: a package pins the
  exact versions of its `@kete-africa` dependencies when it is published, so an app never gets two
  copies of the command journal.

## 0.1.0

### Minor Changes

- fe53b54: First release: one model port for DeepSeek, OpenAI, Anthropic, Mistral and any OpenAI-compatible
  host; capabilities as tools; `ask`, `askStream` and `extract`, metered against monthly token budgets
  per organization and per agent.
