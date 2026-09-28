/**
 * The e-mail port. Business code asks for a template and values; the adapter decides how the
 * message leaves (no vendor name outside adapters — constitution III).
 */
export interface EmailMessage {
  to: string;
  template: 'invitation';
  values: Record<string, string>;
}

export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Until a mail provider exists, messages are logged without the recipient's address, and kept in
 * memory for tests. Invitations still work through their link.
 */
export const outbox: EmailMessage[] = [];

const logAdapter: EmailAdapter = {
  send(message) {
    outbox.push(message);
    if (outbox.length > 100) outbox.shift();
    console.info(`[email:${message.template}] queued (no mail provider configured)`);
    return Promise.resolve();
  },
};

let adapter: EmailAdapter = logAdapter;

export function useEmailAdapter(next: EmailAdapter): void {
  adapter = next;
}

export function sendEmail(message: EmailMessage): Promise<void> {
  return adapter.send(message);
}
