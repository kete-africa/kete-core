import { randomBytes } from 'node:crypto';

/** The prefixes of the identity's own records. */
export const identityIdPrefixes: Readonly<Record<string, string>> = {
  user: 'usr',
  session: 'ses',
  account: 'acc',
  verification: 'ver',
  organization: 'org',
  member: 'mbr',
  invitation: 'inv',
  jwks: 'jwk',
  passkey: 'pky',
};

/**
 * Prefixed identifiers: an agent never confuses a person and an organization (CONCEPTION 11). An
 * instance adds the prefixes of its own records; an unknown model takes its first three letters.
 */
export function prefixedIds(
  extra: Readonly<Record<string, string>> = {},
): (model: string) => string {
  const prefixes = { ...identityIdPrefixes, ...extra };
  return (model) =>
    `${prefixes[model] ?? model.slice(0, 3)}_${randomBytes(12).toString('base64url')}`;
}
