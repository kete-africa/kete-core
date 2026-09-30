// The public entry point of @kete/identity. Anything not exported here is internal.
export { KETE_APPS_AUDIENCE, type KeteClaims } from './claims.js';
export { contactOf, isPlaceholderEmail, placeholderEmail } from './contact.js';
export type { IdentityDatabase } from './database.js';
export {
  createIdentity,
  type Identity,
  type IdentityEmails,
  type IdentityOptions,
} from './identity.js';
export { identityIdPrefixes, prefixedIds } from './ids.js';
export { signInMethodsOf, type SignInMethods } from './methods.js';
export { identityOpenApi } from './openapi.js';
