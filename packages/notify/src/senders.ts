import { checkEmail, type EmailSender, type OutgoingEmail } from './email.js';
import { mailkiteSender } from './mailkite.js';

/** Keeps e-mails in memory: for tests, and to read what would have left. */
export function memorySender(): EmailSender & { sent: OutgoingEmail[] } {
  const sent: OutgoingEmail[] = [];
  return {
    name: 'memory',
    sent,
    send(email) {
      sent.push(checkEmail(email));
      return Promise.resolve({ id: `mem_${sent.length}` });
    },
  };
}

/**
 * When no provider is configured: the e-mail is not sent, and only its subject is logged — never
 * its recipient nor its content, which may carry a secret link.
 */
export function logSender(log: (line: string) => void = console.info): EmailSender {
  let count = 0;
  return {
    name: 'log',
    send(email) {
      checkEmail(email);
      count += 1;
      log(`[email] not sent (no provider configured): "${email.subject}"`);
      return Promise.resolve({ id: `log_${count}` });
    },
  };
}

/**
 * The service's e-mail sender, from its environment: MailKite with `MAILKITE_API_KEY` (and
 * optionally `MAILKITE_BASE_URL`), otherwise nothing leaves and a line is logged.
 */
export function emailSenderFromEnv(env: NodeJS.ProcessEnv = process.env): EmailSender {
  const apiKey = env['MAILKITE_API_KEY'];
  if (!apiKey) return logSender();
  const baseUrl = env['MAILKITE_BASE_URL'];
  return mailkiteSender({ apiKey, ...(baseUrl ? { baseUrl } : {}) });
}
