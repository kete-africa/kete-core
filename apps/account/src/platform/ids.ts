import { randomBytes } from 'node:crypto';

/** Prefixed identifiers: an agent never confuses a person and an organization (CONCEPTION 11). */
const prefixes: Record<string, string> = {
  user: 'usr',
  session: 'ses',
  account: 'acc',
  verification: 'ver',
  organization: 'org',
  member: 'mbr',
  invitation: 'inv',
  jwks: 'jwk',
  file: 'fil',
  offer: 'ofr',
  checkout: 'chk',
  subscription: 'sub',
  signInLink: 'lnk',
  passkey: 'pky',
};

export function prefixedId(model: string): string {
  const prefix = prefixes[model] ?? model.slice(0, 3);
  return `${prefix}_${randomBytes(12).toString('base64url')}`;
}
