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
export { createKeteSignIn, SignInError, type KeteSignIn, type SignInOptions } from './signin.js';
