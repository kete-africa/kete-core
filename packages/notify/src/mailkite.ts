import { createHmac, timingSafeEqual } from 'node:crypto';
import { checkEmail, EmailError, type EmailSender } from './email.js';

export interface MailkiteOptions {
  /** A key restricted to the sending domain (doctrine D-031), from the environment. */
  apiKey: string;
  /** Default `https://api.mailkite.dev`. */
  baseUrl?: string;
  /** For tests. */
  fetch?: typeof fetch;
}

/**
 * The MailKite adapter of the e-mail port (doctrine D-031): `POST /v1/send`, a Bearer key, `202`
 * with the message identifier. A 4xx means the provider refused this e-mail; a 5xx or a network
 * failure means it may be retried.
 */
export function mailkiteSender(options: MailkiteOptions): EmailSender {
  const baseUrl = (options.baseUrl ?? 'https://api.mailkite.dev').replace(/\/+$/, '');
  const send = options.fetch ?? fetch;
  return {
    name: 'mailkite',
    async send(email) {
      checkEmail(email);
      let response: Response;
      try {
        response = await send(`${baseUrl}/v1/send`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            from: email.from,
            to: email.to,
            subject: email.subject,
            html: email.html,
            text: email.text,
            ...(email.replyTo ? { replyTo: email.replyTo } : {}),
            ...(email.metadata ? { metadata: email.metadata } : {}),
            ...(email.attachments ? { attachments: email.attachments } : {}),
          }),
        });
      } catch {
        throw new EmailError('provider_unavailable', 'MailKite could not be reached.');
      }
      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429;
        throw new EmailError(
          retryable ? 'provider_unavailable' : 'provider_refused',
          `MailKite answered ${response.status}.`,
          response.status,
        );
      }
      const body = (await response.json()) as { id?: string };
      if (!body.id) throw new EmailError('provider_refused', 'MailKite returned no message id.');
      return { id: body.id };
    },
  };
}

export interface MailkiteSignature {
  /** The `x-mailkite-signature` header: `t=<unix ms>,v1=<hex HMAC-SHA256>`. */
  header: string | null;
  /** The raw request body, byte for byte (never re-serialized JSON). */
  rawBody: string;
  /** The route's webhook signing secret. */
  secret: string;
  /** Default: now. */
  now?: number;
  /** Default 5 minutes; 0 disables the freshness check. */
  toleranceMs?: number;
}

/**
 * Verifies a MailKite webhook (inbound `email.received` and outbound `email.*` events): HMAC-SHA256
 * of `${t}.${rawBody}`, compared in constant time, within the tolerance window.
 */
export function verifyMailkiteSignature(input: MailkiteSignature): boolean {
  if (!input.header || !input.secret) return false;
  const parts = Object.fromEntries(
    input.header.split(',').map((part) => {
      const index = part.indexOf('=');
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    }),
  );
  const timestamp = Number(parts['t']);
  const signature = parts['v1'];
  if (!Number.isFinite(timestamp) || !signature || !/^[0-9a-f]+$/.test(signature)) return false;
  const tolerance = input.toleranceMs ?? 300_000;
  if (tolerance > 0 && Math.abs((input.now ?? Date.now()) - timestamp) > tolerance) return false;
  const expected = createHmac('sha256', input.secret)
    .update(`${parts['t']}.${input.rawBody}`)
    .digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
