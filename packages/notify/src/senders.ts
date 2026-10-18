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

/** An e-mail kept by the test mailbox, with when it was kept. */
export interface KeptEmail extends OutgoingEmail {
  id: string;
  at: string;
}

export type TestMailbox = EmailSender & {
  /** The kept e-mails, the latest first. */
  list(): KeptEmail[];
};

/**
 * The test mailbox (spec 132): an environment without a provider keeps its e-mails — to any
 * domain, nothing leaves — so the flows that need one (an invitation, a new password) are tried
 * end to end. Kept in memory, the latest `limit` ones; a restart empties it. Never in production:
 * the service shows them only to its operators.
 */
export function testMailbox(options: { limit?: number; now?: () => Date } = {}): TestMailbox {
  const limit = options.limit ?? 200;
  const now = options.now ?? (() => new Date());
  let kept: KeptEmail[] = [];
  let count = 0;
  return {
    name: 'test-mailbox',
    send(email) {
      checkEmail(email);
      count += 1;
      const id = `test_${count}`;
      kept = [{ ...email, id, at: now().toISOString() }, ...kept].slice(0, limit);
      return Promise.resolve({ id });
    },
    list: () => kept,
  };
}

let mailbox: TestMailbox | undefined;

/**
 * The service's e-mail sender, from its environment: MailKite with `MAILKITE_API_KEY` (and
 * optionally `MAILKITE_BASE_URL`); otherwise, with `KETE_TEST_MAILBOX=on`, the test mailbox (one per
 * process); otherwise nothing leaves and a line is logged.
 */
export function emailSenderFromEnv(env: NodeJS.ProcessEnv = process.env): EmailSender {
  const apiKey = env['MAILKITE_API_KEY'];
  if (!apiKey && env['KETE_TEST_MAILBOX'] === 'on') {
    mailbox ??= testMailbox();
    return mailbox;
  }
  if (!apiKey) return logSender();
  const baseUrl = env['MAILKITE_BASE_URL'];
  return mailkiteSender({ apiKey, ...(baseUrl ? { baseUrl } : {}) });
}
