import { randomBytes } from 'node:crypto';
import { memorySender } from '@kete/notify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth } from '@/platform/auth';
import { getPool } from '@/platform/db';
import { useEmailSender } from '@/platform/email';

// Spec 025: the Compte Kete's e-mails leave through @kete/notify — invitations, and the link to
// choose a new password, only for an account that has one.

const run = randomBytes(4).toString('hex');
const owner = new pg.Pool({ connectionString: process.env.ACCOUNT_TEST_OWNER_URL, max: 1 });
const sender = memorySender();
useEmailSender(sender);

const api = auth.api as unknown as {
  signUpEmail(input: {
    body: { name: string; email: string; password: string };
    returnHeaders: true;
  }): Promise<{ headers: Headers }>;
  signInEmail(input: { body: { email: string; password: string } }): Promise<unknown>;
  createOrganization(input: {
    body: { name: string; slug: string };
    headers: Headers;
  }): Promise<{ id: string }>;
  createInvitation(input: {
    body: { email: string; role: string; organizationId: string };
    headers: Headers;
  }): Promise<{ id: string }>;
  requestPasswordReset(input: { body: { email: string; redirectTo: string } }): Promise<unknown>;
  resetPassword(input: { body: { newPassword: string; token: string } }): Promise<unknown>;
};

const ama = `ama.${run}@example.test`;
const kofi = `kofi.${run}@example.test`;
const passkeyOnly = `passkey.${run}@example.test`;
const firstPassword = `first-${randomBytes(8).toString('hex')}`;
let cookie = '';

function lastTo(address: string) {
  return sender.sent.filter((email) => email.to === address).at(-1);
}

beforeAll(async () => {
  const signUp = await api.signUpEmail({
    body: { name: 'Ama', email: ama, password: firstPassword },
    returnHeaders: true,
  });
  cookie = signUp.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  // A person without any password: she signs in with passkeys only (spec 016).
  await owner.query(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ($1, 'Passkey', $2, false, now(), now())`,
    [`usr_pk_${run}`, passkeyOnly],
  );
});

afterAll(async () => {
  await owner.query(`delete from organization where slug = $1`, [`emails-${run}`]);
  await owner.query(`delete from "user" where email = any($1)`, [[ama, kofi, passkeyOnly]]);
  await owner.end();
  await getPool().end();
});

describe('invitations', () => {
  it('are e-mailed with their link, in the inviter’s organization name', async () => {
    const organization = await api.createOrganization({
      body: { name: `Atelier ${run}`, slug: `emails-${run}` },
      headers: new Headers({ cookie }),
    });
    const invitation = await api.createInvitation({
      body: { email: kofi, role: 'member', organizationId: organization.id },
      headers: new Headers({ cookie }),
    });
    const email = lastTo(kofi);
    expect(email?.subject).toContain(`Atelier ${run}`);
    expect(email?.html).toContain(`/invitation/${invitation.id}`);
    expect(email?.text).toContain(`/invitation/${invitation.id}`);
    expect(email?.metadata).toEqual({ template: 'invitation' });
  });
});

describe('a new password', () => {
  it('is chosen through the e-mailed link; the old one then opens nothing', async () => {
    await api.requestPasswordReset({ body: { email: ama, redirectTo: '/reset-password' } });
    const email = lastTo(ama);
    expect(email?.metadata).toEqual({ template: 'password-reset' });
    const link = /https?:\/\/[^\s"<>]+\/reset-password\/([A-Za-z0-9_-]+)/.exec(email?.text ?? '');
    expect(link).not.toBeNull();
    const newPassword = `new-${randomBytes(8).toString('hex')}`;
    await api.resetPassword({ body: { newPassword, token: link?.[1] ?? '' } });
    await expect(
      api.signInEmail({ body: { email: ama, password: newPassword } }),
    ).resolves.toBeTruthy();
    await expect(
      api.signInEmail({ body: { email: ama, password: firstPassword } }),
    ).rejects.toThrow();
  });

  it('is never given by e-mail to an account without a password; it learns why', async () => {
    await api.requestPasswordReset({
      body: { email: passkeyOnly, redirectTo: '/reset-password' },
    });
    const email = lastTo(passkeyOnly);
    expect(email?.metadata).toEqual({ template: 'password-reset-unavailable' });
    expect(email?.text).not.toMatch(/reset-password\//);
  });

  it('sends nothing for an unknown address, and says nothing either', async () => {
    const before = sender.sent.length;
    await expect(
      api.requestPasswordReset({
        body: { email: `nobody.${run}@example.test`, redirectTo: '/reset-password' },
      }),
    ).resolves.toBeTruthy();
    expect(sender.sent.length).toBe(before);
  });
});
