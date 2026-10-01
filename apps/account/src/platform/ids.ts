import { prefixedIds } from '@kete/identity';

/** Prefixed identifiers: the identity's, and the Compte Kete's own records. */
export const prefixedId = prefixedIds({
  file: 'fil',
  offer: 'ofr',
  checkout: 'chk',
  subscription: 'sub',
  signInLink: 'lnk',
});
