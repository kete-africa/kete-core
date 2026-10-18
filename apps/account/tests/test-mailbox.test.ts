import { testMailbox } from '@kete/notify';
import { afterEach, describe, expect, it } from 'vitest';
import { passwordResetEmail } from '@/features/emails/templates';
import { keptMails, testMailboxOpenTo } from '@/features/test-mailbox/mailbox.server';
import { sendEmail, testMails, useEmailSender } from '@/platform/email';

// Spec 132: where no mail provider is configured, the Compte Kete keeps what it would have sent —
// to any domain — in its test mailbox, read by Kete's operators only, never in production.

const environment = process.env.KETE_ENVIRONMENT;
afterEach(() => {
  process.env.KETE_ENVIRONMENT = environment;
});

describe('the test mailbox', () => {
  it('keeps a new password’s link sent to any domain, its words readable', async () => {
    useEmailSender(testMailbox());
    await sendEmail(passwordResetEmail, {
      to: 'kossi@n-importe-quel-domaine.test',
      values: { link: 'https://compte.kete.test/reset-password?token=t1' },
      locale: 'fr',
    });
    const [kept] = keptMails();
    expect(kept).toMatchObject({ to: 'kossi@n-importe-quel-domaine.test' });
    expect(kept?.text).toContain('https://compte.kete.test/reset-password?token=t1');
  });

  it('is never read in production, and only by an operator elsewhere', async () => {
    process.env.KETE_ENVIRONMENT = 'production';
    expect(testMails()).toBeNull();
    process.env.KETE_ENVIRONMENT = 'staging';
    expect(testMails()).not.toBeNull();
    // Without Kete's organization named, nobody is an operator.
    const operators = process.env.KETE_OPERATORS_ORGANIZATION_ID;
    delete process.env.KETE_OPERATORS_ORGANIZATION_ID;
    expect(await testMailboxOpenTo('usr_anyone')).toBe(false);
    if (operators) process.env.KETE_OPERATORS_ORGANIZATION_ID = operators;
  });
});
