import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

// A person's mailbox (spec 113, FR-004; decision 0012): the mail she receives is read by IMAP, and
// an answer from a thread leaves from her own box by SMTP — with the thread's own address for
// replies, so the answer by mail comes back into it — and is kept in her Sent folder. The password
// is the product's to seal: it is given here, never written anywhere.

export interface MailAccount {
  host: string;
  port?: number;
  /** TLS from the start (993 for IMAP, 465 for SMTP). */
  secure?: boolean;
  user: string;
  password: string;
}

/** What a mailbox gives: the raw mails after a point, and that point to start from next time. */
export interface Mailbox {
  fetchSince(lastUid: number): Promise<{ uid: number; source: Uint8Array }[]>;
  appendSent(source: Uint8Array): Promise<void>;
}

/** A mailbox read by IMAP (ImapFlow): the INBOX's mails after a uid, the Sent folder appended. */
export function imapMailbox(account: MailAccount, options: { sent?: string } = {}): Mailbox {
  const connect = async () => {
    const client = new ImapFlow({
      host: account.host,
      port: account.port ?? 993,
      secure: account.secure ?? true,
      auth: { user: account.user, pass: account.password },
      logger: false,
    });
    await client.connect();
    return client;
  };
  return {
    async fetchSince(lastUid) {
      const client = await connect();
      try {
        const lock = await client.getMailboxLock('INBOX');
        try {
          const found: { uid: number; source: Uint8Array }[] = [];
          for await (const mail of client.fetch(
            `${lastUid + 1}:*`,
            { uid: true, source: true },
            { uid: true },
          )) {
            if (mail.uid > lastUid && mail.source) {
              found.push({ uid: mail.uid, source: new Uint8Array(mail.source) });
            }
          }
          return found;
        } finally {
          lock.release();
        }
      } finally {
        await client.logout();
      }
    },
    async appendSent(source) {
      const client = await connect();
      try {
        await client.append(options.sent ?? 'Sent', Buffer.from(source), ['\\Seen']);
      } finally {
        await client.logout();
      }
    },
  };
}

/** A mailbox in memory: what the tests and the demo read and write. */
export function memoryMailbox(initial: string[] = []): Mailbox & {
  deliver(source: string): number;
  sent: Uint8Array[];
} {
  const inbox = initial.map((source, index) => ({
    uid: index + 1,
    source: new TextEncoder().encode(source),
  }));
  const sent: Uint8Array[] = [];
  return {
    sent,
    deliver(source) {
      const uid = (inbox.at(-1)?.uid ?? 0) + 1;
      inbox.push({ uid, source: new TextEncoder().encode(source) });
      return uid;
    },
    fetchSince: async (lastUid) => inbox.filter((mail) => mail.uid > lastUid),
    appendSent: async (source) => {
      sent.push(source);
    },
  };
}

export interface OutgoingMail {
  from: { name?: string; address: string };
  to: string[];
  subject: string;
  text: string;
  /** The thread's own address: the answer by mail comes back into it. */
  replyTo?: string;
  /** The Message-ID answered, so mail programs keep the conversation together. */
  inReplyTo?: string;
}

/** What sends a mail and gives its raw source back (to keep it in the Sent folder). */
export interface MailSender {
  send(mail: OutgoingMail): Promise<{ messageId: string; source: Uint8Array }>;
}

const toNodemailer = (mail: OutgoingMail) => ({
  from: mail.from.name ? { name: mail.from.name, address: mail.from.address } : mail.from.address,
  to: mail.to,
  subject: mail.subject,
  text: mail.text,
  ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
  ...(mail.inReplyTo ? { inReplyTo: mail.inReplyTo, references: [mail.inReplyTo] } : {}),
});

/** Sends from her own box by SMTP (Nodemailer); the source is built first, the same that leaves. */
export function smtpSender(account: MailAccount): MailSender {
  const build = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const transport = nodemailer.createTransport({
    host: account.host,
    port: account.port ?? 465,
    secure: account.secure ?? true,
    auth: { user: account.user, pass: account.password },
  });
  return {
    async send(mail) {
      const built = await build.sendMail(toNodemailer(mail));
      const source = new Uint8Array(built.message as Buffer);
      await transport.sendMail({
        envelope: { from: mail.from.address, to: mail.to },
        raw: Buffer.from(source),
      });
      return { messageId: built.messageId, source };
    },
  };
}

/** A sender that keeps what it would send: the tests and the demo. */
export function memorySender(): MailSender & { sent: OutgoingMail[] } {
  const build = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const sent: OutgoingMail[] = [];
  return {
    sent,
    async send(mail) {
      sent.push(mail);
      const built = await build.sendMail(toNodemailer(mail));
      return { messageId: built.messageId, source: new Uint8Array(built.message as Buffer) };
    },
  };
}
