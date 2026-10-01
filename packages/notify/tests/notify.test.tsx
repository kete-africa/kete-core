import { createHmac } from 'node:crypto';
import { Button, Html, Text } from '@react-email/components';
import { describe, expect, it } from 'vitest';
import {
  checkEmail,
  createMailer,
  defineEmailTemplate,
  EmailError,
  emailSenderFromEnv,
  logSender,
  mailkiteSender,
  memorySender,
  verifyMailkiteSignature,
  type OutgoingEmail,
} from '../src/index.js';

const email: OutgoingEmail = {
  from: 'Kete <compte@kete.africa>',
  to: 'ama@example.com',
  subject: 'Invitation',
  html: '<p>Bonjour</p>',
  text: 'Bonjour',
  metadata: { template: 'invitation' },
};

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('the MailKite adapter', () => {
  it('sends through POST /v1/send with the Bearer key, and returns the message id', async () => {
    const { fn, calls } = fakeFetch(202, { id: 'msg_1', status: 'queued' });
    const sender = mailkiteSender({ apiKey: 'mk_test_key', fetch: fn });
    expect(await sender.send(email)).toEqual({ id: 'msg_1' });
    expect(calls[0]?.url).toBe('https://api.mailkite.dev/v1/send');
    expect(calls[0]?.init.headers).toMatchObject({ authorization: 'Bearer mk_test_key' });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      from: 'Kete <compte@kete.africa>',
      to: 'ama@example.com',
      subject: 'Invitation',
      html: '<p>Bonjour</p>',
      text: 'Bonjour',
      metadata: { template: 'invitation' },
    });
  });

  it('says whether a failure may be retried', async () => {
    await expect(
      mailkiteSender({ apiKey: 'k', fetch: fakeFetch(422, {}).fn }).send(email),
    ).rejects.toMatchObject({ code: 'provider_refused', status: 422 });
    await expect(
      mailkiteSender({ apiKey: 'k', fetch: fakeFetch(503, {}).fn }).send(email),
    ).rejects.toMatchObject({ code: 'provider_unavailable', status: 503 });
    const down = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(mailkiteSender({ apiKey: 'k', fetch: down }).send(email)).rejects.toMatchObject({
      code: 'provider_unavailable',
    });
  });

  it('refuses an e-mail without a valid sender, recipient or subject, before any call', async () => {
    const { fn, calls } = fakeFetch(202, { id: 'x' });
    const sender = mailkiteSender({ apiKey: 'k', fetch: fn });
    await expect(sender.send({ ...email, to: 'not-an-address' })).rejects.toBeInstanceOf(
      EmailError,
    );
    expect(() => checkEmail({ ...email, subject: ' ' })).toThrow(EmailError);
    expect(calls).toHaveLength(0);
  });
});

describe('MailKite webhooks', () => {
  const secret = 'whsec_test';
  const rawBody = '{"type":"email.delivered","id":"msg_1"}';
  const now = 1_790_000_000_000;
  const sign = (t: number, body = rawBody, key = secret) =>
    `t=${t},v1=${createHmac('sha256', key).update(`${t}.${body}`).digest('hex')}`;

  it('accepts a fresh, correctly signed body', () => {
    expect(verifyMailkiteSignature({ header: sign(now), rawBody, secret, now })).toBe(true);
  });

  it('refuses a changed body, another secret, a stale signature and a malformed header', () => {
    expect(
      verifyMailkiteSignature({ header: sign(now), rawBody: `${rawBody} `, secret, now }),
    ).toBe(false);
    expect(
      verifyMailkiteSignature({ header: sign(now, rawBody, 'other'), rawBody, secret, now }),
    ).toBe(false);
    expect(verifyMailkiteSignature({ header: sign(now - 301_000), rawBody, secret, now })).toBe(
      false,
    );
    expect(verifyMailkiteSignature({ header: 'garbage', rawBody, secret, now })).toBe(false);
    expect(verifyMailkiteSignature({ header: null, rawBody, secret, now })).toBe(false);
  });
});

const invitation = defineEmailTemplate<{ organization: string; link: string }>({
  name: 'invitation',
  render: ({ organization, link }, locale) => ({
    subject: locale === 'en' ? `Join ${organization}` : `Rejoignez ${organization}`,
    body: (
      <Html lang={locale}>
        <Text>{locale === 'en' ? 'You are invited.' : 'Vous êtes invité.'}</Text>
        <Button href={link}>{locale === 'en' ? 'Accept' : 'Accepter'}</Button>
      </Html>
    ),
  }),
});

describe('the mailer', () => {
  it('renders a template in the recipient’s language, as HTML and plain text', async () => {
    const sender = memorySender();
    const mailer = createMailer({ sender, from: 'Kete <compte@kete.africa>' });
    await mailer.send(invitation, {
      to: 'kofi@example.com',
      values: { organization: 'Atelier Kofi', link: 'https://compte.kete.africa/invitation/inv_1' },
      locale: 'fr',
    });
    const [sent] = sender.sent;
    expect(sent?.subject).toBe('Rejoignez Atelier Kofi');
    expect(sent?.html).toContain('href="https://compte.kete.africa/invitation/inv_1"');
    expect(sent?.html).toContain('lang="fr"');
    expect(sent?.text).toContain('Vous êtes invité.');
    expect(sent?.metadata).toEqual({ template: 'invitation' });
  });
});

describe('senders', () => {
  it('logs only the subject when no provider is configured, never the recipient', async () => {
    const lines: string[] = [];
    await logSender((line) => lines.push(line)).send(email);
    expect(lines).toEqual(['[email] not sent (no provider configured): "Invitation"']);
    expect(lines.join()).not.toContain('ama@example.com');
  });

  it('chooses MailKite when its key is in the environment', () => {
    expect(emailSenderFromEnv({ MAILKITE_API_KEY: 'mk_test' }).name).toBe('mailkite');
    expect(emailSenderFromEnv({}).name).toBe('log');
  });
});
