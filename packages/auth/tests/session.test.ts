import { describe, expect, it } from 'vitest';
import { createKeteSignIn, mayRead, refusalOf, signSession } from '../src/index.js';

// Spec 093: the session an app's sign-in writes, written the same way by a browser test — read
// back by the app as if the Compte Kete had answered.

const sessionSecret = 'a-session-secret-of-the-tests-only-0123456789';
const signIn = createKeteSignIn({
  accountUrl: 'https://compte.kete.test',
  clientId: 'nettio',
  clientSecret: 'x',
  redirectUri: 'https://nettio.test/auth/callback',
  sessionSecret,
  jwks: { keys: [] },
});
const withCookie = (value: string) =>
  new Request('https://nettio.test/', { headers: { cookie: `kete_session=${value}` } });

describe('a session for a browser test', () => {
  it('is read back by the app as its own: person, organization, role, offer', async () => {
    const until = new Date(Date.now() + 86_400_000);
    const value = await signSession(sessionSecret, {
      userId: 'usr_essi',
      email: 'essi@example.test',
      name: 'Essi',
      organizationId: 'org_e2e_bleu',
      role: 'member',
      apps: { nettio: until },
      plans: {
        nettio: {
          offer: 'Nettio — essai',
          trial: true,
          until,
          readableUntil: new Date(until.getTime() + 30 * 86_400_000),
          limits: { people: 3 },
        },
      },
    });
    const session = await signIn.session(withCookie(value));
    expect(session).toMatchObject({
      userId: 'usr_essi',
      organizationId: 'org_e2e_bleu',
      role: 'member',
      twoFactor: false,
    });
    expect(session && refusalOf(session, 'nettio', { limit: 'people', used: 3 })).toMatchObject({
      reason: 'limit',
    });
    expect(session && mayRead(session, 'nettio')).toBe(true);
  });

  it('is refused when signed with another secret, and needs a real secret', async () => {
    const forged = await signSession('another-secret-of-at-least-thirty-two-chars', {
      userId: 'usr_x',
      email: 'x@example.test',
      name: 'X',
      organizationId: 'org_x',
      role: 'owner',
    });
    expect(await signIn.session(withCookie(forged))).toBeNull();
    await expect(
      signSession('short', {
        userId: 'u',
        email: 'e',
        name: 'n',
        organizationId: null,
        role: null,
      }),
    ).rejects.toThrow(/32/);
  });
});
