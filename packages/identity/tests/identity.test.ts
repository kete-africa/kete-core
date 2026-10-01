import { describe, expect, it } from 'vitest';
import {
  contactOf,
  identityOpenApi,
  isPlaceholderEmail,
  placeholderEmail,
  prefixedIds,
} from '../src/index.js';

// The identity's behavior against a database — passwords, passkeys, invitations, resets, tokens —
// is proven by the Compte Kete, which runs on it: its tests and end-to-end tests (spec 026).

describe('prefixed identifiers', () => {
  it('name what they identify, with the instance’s own prefixes beside the identity’s', () => {
    const idOf = prefixedIds({ offer: 'ofr' });
    expect(idOf('user')).toMatch(/^usr_[\w-]{16}$/);
    expect(idOf('organization')).toMatch(/^org_/);
    expect(idOf('passkey')).toMatch(/^pky_/);
    expect(idOf('offer')).toMatch(/^ofr_/);
    expect(idOf('checkout')).toMatch(/^che_/);
    expect(idOf('user')).not.toBe(idOf('user'));
  });
});

describe('people provisioned by phone', () => {
  it('have a placeholder address that never resolves, and are shown by their number', () => {
    const email = placeholderEmail('+22890000000');
    expect(email).toBe('p22890000000@phone.kete.invalid');
    expect(isPlaceholderEmail(email)).toBe(true);
    expect(contactOf({ email, phoneNumber: '+22890000000' })).toBe('+22890000000');
    expect(contactOf({ email: 'ama@example.com', phoneNumber: null })).toBe('ama@example.com');
  });
});

describe('the OpenAPI description', () => {
  it('describes every endpoint the identity serves, without a database', async () => {
    const document = await identityOpenApi({
      baseURL: 'https://compte.example.test',
      scopes: ['kete:people'],
    });
    expect(document['openapi']).toMatch(/^3\./);
    const paths = Object.keys(document['paths'] as Record<string, unknown>);
    for (const path of [
      '/sign-in/email',
      '/request-password-reset',
      '/organization/invite-member',
      '/passkey/delete-passkey',
      '/two-factor/enable',
      '/sign-in/magic-link',
      '/jwks',
      '/oauth2/authorize',
      '/oauth2/token',
    ]) {
      expect(paths).toContain(path);
    }
  });
});
