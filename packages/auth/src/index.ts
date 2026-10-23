// The public entry point of @kete/auth. Anything not exported here is internal.

export {
  canUse,
  createTokenVerifier,
  InvalidTokenError,
  type KeteIdentity,
  type KeteRole,
  type TokenVerifier,
  type TokenVerifierOptions,
} from './verify.js';
export {
  limitNames,
  limitOf,
  mayRead,
  planOf,
  PlanRefusedError,
  refusalOf,
  requireWithinPlan,
  type KetePlan,
  type LimitName,
  type Refusal,
} from './plans.js';
export { signSession, type SessionPerson } from './session.js';
export { createKeteSignIn, SignInError, type KeteSignIn, type SignInOptions } from './signin.js';
export {
  createAppToken,
  createAppTokenVerifier,
  createMandates,
  createStandingMandates,
  type StandingMandates,
  type AppTokenOptions,
  type MandatesOptions,
  type AppTokenVerifier,
  type AppTokenVerifierOptions,
  type KeteApp,
} from './app-token.js';
