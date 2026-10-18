import {
  createMailer,
  emailSenderFromEnv,
  type EmailSender,
  type EmailTemplate,
  type KeptEmail,
  type SentEmail,
} from '@kete/notify';
import { getLocale } from '../paraglide/runtime.js';

/**
 * The Compte Kete's e-mails, through the e-mail port of @kete/notify (doctrine D-031): MailKite
 * with `MAILKITE_API_KEY`, otherwise nothing leaves and only the subject is logged. The sender is
 * an address of a domain verified at the provider (`ACCOUNT_MAIL_FROM`).
 */
let sender: EmailSender | null = null;

/** Replaces the sender (tests use `memorySender()`). */
export function useEmailSender(next: EmailSender): void {
  sender = next;
}

function from(): string {
  return process.env.ACCOUNT_MAIL_FROM ?? 'Kete <compte@kete.africa>';
}

/** The language of the current request, or French outside a request. */
function requestLocale(): string {
  try {
    return getLocale();
  } catch {
    return 'fr';
  }
}

/**
 * What the test mailbox kept (spec 132: `KETE_TEST_MAILBOX=on`, no provider key, never in
 * production); null when the e-mails leave or are only logged.
 */
export function testMails(): KeptEmail[] | null {
  if (process.env.KETE_ENVIRONMENT === 'production') return null;
  sender ??= emailSenderFromEnv();
  return 'list' in sender && typeof sender.list === 'function'
    ? (sender.list() as KeptEmail[])
    : null;
}

export function sendEmail<Values>(
  template: EmailTemplate<Values>,
  message: { to: string; values: Values; locale?: string },
): Promise<SentEmail> {
  sender ??= emailSenderFromEnv();
  return createMailer({ sender, from: from() }).send(template, {
    to: message.to,
    values: message.values,
    locale: message.locale ?? requestLocale(),
  });
}
