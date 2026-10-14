// The public entry point of @kete/lifecycle: the rules, pure — for screens and servers. Where the
// lifecycle is kept is `@kete/lifecycle/server`. Anything not exported here is internal.
export {
  autonomyProof,
  budgetOf,
  nextState,
  nextWake,
  wokenBy,
  type AgentSignal,
  type AgentState,
  type AutonomyProof,
  type Decision,
  type Trigger,
} from './agent.js';
export {
  CASES_FOR,
  nextTier,
  readiness,
  reviewerFor,
  TIERS,
  type Missing,
  type Risk,
  type Tier,
} from './tiers.js';
