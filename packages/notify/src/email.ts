/** An e-mail ready to leave: what every e-mail adapter sends. */
export interface OutgoingEmail {
  /** `Kete <compte@kete.africa>` — an address of a domain verified at the provider. */
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Facts for the provider's logs and webhooks: never personal data. */
  metadata?: Record<string, string>;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  /** Base64 content, or a URL the provider fetches. */
  content?: string;
  url?: string;
  contentType?: string;
}

export interface SentEmail {
  /** The provider's message identifier. */
  id: string;
}

/**
 * The e-mail port (doctrine D-014): business code sends through it, never through a vendor. The
 * adapter decides how the message leaves.
 */
export interface EmailSender {
  readonly name: string;
  send(email: OutgoingEmail): Promise<SentEmail>;
}

export class EmailError extends Error {
  constructor(
    readonly code: 'invalid_email' | 'provider_refused' | 'provider_unavailable',
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'EmailError';
  }
}

const address = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const named = /^[^<>]*<([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)>$/;

/** Whether `value` is an address, bare or named (`Kete <compte@kete.africa>`). */
export function isEmailAddress(value: string): boolean {
  return address.test(value) || named.test(value);
}

/** Checks an e-mail before any adapter sends it. */
export function checkEmail(email: OutgoingEmail): OutgoingEmail {
  const recipients = Array.isArray(email.to) ? email.to : [email.to];
  if (!isEmailAddress(email.from)) throw new EmailError('invalid_email', 'Invalid sender.');
  if (recipients.length === 0 || !recipients.every(isEmailAddress)) {
    throw new EmailError('invalid_email', 'Invalid recipient.');
  }
  if (!email.subject.trim()) throw new EmailError('invalid_email', 'An e-mail needs a subject.');
  return email;
}
