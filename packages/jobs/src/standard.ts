import type { EmailSender, OutgoingEmail, SentEmail } from '@kete/notify';
import { defineJob, type JobDefinition, type Jobs } from './jobs.js';

export const SEND_EMAIL = 'send-email';

/**
 * Sends the e-mails queued by `queuedSender`, through the app's real sender (MailKite). A
 * provider's refusal is final: it is logged, never retried; an unavailable provider is retried,
 * five times, further and further apart.
 */
export function sendEmailJob(sender: EmailSender): JobDefinition<OutgoingEmail> {
  return defineJob<OutgoingEmail>({
    name: SEND_EMAIL,
    retryLimit: 5,
    retryDelay: 60,
    retryBackoff: true,
    async handle(email) {
      try {
        await sender.send(email);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'provider_refused' || code === 'invalid_email') {
          console.warn(`[jobs] e-mail refused, not retried: ${code}`);
          return;
        }
        throw error;
      }
    },
  });
}

/**
 * An `EmailSender` for the web process: it queues the e-mail and answers at once; the worker sends
 * it (`sendEmailJob`). The request never waits for the provider, and a provider's outage is retried.
 */
export function queuedSender(jobs: Jobs): EmailSender {
  return {
    name: 'queued',
    async send(email): Promise<SentEmail> {
      const id = await jobs.send(SEND_EMAIL, email);
      return { id: id ?? 'queued' };
    },
  };
}

export const RELAY_EVENTS = 'relay-events';

/** Sends the outbox's events to Kete Cockpit every minute (@kete/sdk's relay). */
export function relayEventsJob(relay: () => Promise<unknown>): JobDefinition<object> {
  return defineJob<object>({
    name: RELAY_EVENTS,
    schedule: '* * * * *',
    retryLimit: 0,
    async handle() {
      await relay();
    },
  });
}
