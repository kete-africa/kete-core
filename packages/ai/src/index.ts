// The public entry point of @kete/ai. Anything not exported here is internal.

export { ask, askStream, extract, toolsFrom, usageOf, type Answer, type Metering } from './ask.js';
export {
  aiCostMigrationSql,
  aiMigrationSql,
  BudgetExceededError,
  postgresBudgetStore,
  scopesOf,
  type AiMigrationOptions,
  type BudgetScope,
  type BudgetStore,
  type Usage,
  type UsageContext,
  type UsageLine,
} from './budget.js';
export {
  costOf,
  modelPrice,
  modelPricesFromEnv,
  observeModels,
  tracesContent,
  type ModelPrice,
  type ModelPrices,
  type ObservedModels,
} from './observability.js';
export {
  embeddingModel,
  hostedShell,
  languageModel,
  ModelConfigError,
  modelConfigFromEnv,
  modelProviders,
  transcriptionModel,
  type HostedSkill,
  type ModelConfig,
  type ModelProvider,
} from './providers.js';
export { dictation, type Dictated, type DictationPort } from './dictate.js';
export { scanReader } from './scans.js';
export { intake, type Intake, type IntakeProvenance, type IntakeSource } from './intake.js';
