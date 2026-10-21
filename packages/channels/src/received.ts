import type { ChatInbound } from '@kete/notify';
import EmailReplyParser from 'email-reply-parser';
import { simpleParser, type AddressObject } from 'mailparser';

// What the outside says (spec 113, FR-003), the same whatever the channel: a WhatsApp or Telegram
// message (as `@kete/notify` proved it), a mail (read by IMAP, parsed here), a form's submission.
// Its reference on its channel makes it received once.

export type Via = 'whatsapp' | 'telegram' | 'mail' | 'form';

export interface ReceivedAttachment {
  name: string;
  mediaType: string | null;
  /** The bytes, when the channel gave them (mail); a chat's media is fetched by its id. */
  content?: Uint8Array;
  mediaId?: string;
}

export interface Received {
  via: Via;
  /** Its own reference on its channel: a provider's message id, a mail's Message-ID. */
  ref: string;
  from: {
    /** How the router knows the sender: `whatsapp:22890…`, `mail:abla@kya.tg`, `form:…`. */
    key: string;
    name: string | null;
    phone: string | null;
    address: string | null;
  };
  /** Where it was sent: a mail's recipients, so a thread's own address is recognized. */
  to: string[];
  subject: string | null;
  /** Its words; a mail's without the quoted history nor the signature (spec 140, FR-015). */
  text: string;
  /** A mail's whole words, as it came: what « Voir le mail d'origine » shows. */
  original?: string;
  /** The mail it answers, and the conversation before it: where a reply finds its thread. */
  inReplyTo?: string;
  references?: string[];
  /** `out`: read from a Sent folder — the organization's person wrote it, to the outside. */
  direction?: 'in' | 'out';
  attachments: ReceivedAttachment[];
  at: string;
}

const lower = (value: string) => value.trim().toLowerCase();

/** A chat message as `@kete/notify` heard it. */
export function fromChat(message: ChatInbound, at = new Date()): Received {
  const via: Via = message.channel === 'telegram' ? 'telegram' : 'whatsapp';
  return {
    via,
    ref: message.providerMessageId,
    from: {
      key: `${via}:${message.sender.phone ?? message.sender.id}`,
      name: message.sender.displayName,
      phone: message.sender.phone,
      address: null,
    },
    to: [],
    subject: null,
    text: message.text ?? '',
    attachments: message.media
      ? [
          {
            name: message.media.filename ?? message.kind,
            mediaType: message.media.mediaType,
            mediaId: message.media.id,
          },
        ]
      : [],
    at: at.toISOString(),
  };
}

const addresses = (field: AddressObject | AddressObject[] | undefined) =>
  (Array.isArray(field) ? field : field ? [field] : [])
    .flatMap((group) => group.value)
    .flatMap((entry) => (entry.address ? [lower(entry.address)] : []));

const ids = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value : value ? value.split(/\s+/) : [])
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

/** A mail's words without what it quotes nor its signature; the whole words if nothing is left. */
export function cleanMail(text: string): string {
  const visible = new EmailReplyParser().parseReply(text).trim();
  return visible || text.trim();
}

/**
 * A mail as its raw source (RFC 5322, a `.eml` file), parsed: its sender, its recipients, its words
 * cleaned and whole, what it answers, its files. Read from a Sent folder, it is `out`.
 */
export async function fromMail(
  source: string | Uint8Array,
  options: { direction?: 'in' | 'out' } = {},
): Promise<Received> {
  const mail = await simpleParser(Buffer.from(source));
  const sender = mail.from?.value[0];
  const address = sender?.address ? lower(sender.address) : null;
  const whole = (mail.text ?? '').trim();
  const inReplyTo = ids(mail.inReplyTo)[0];
  const references = ids(mail.references);
  return {
    via: 'mail',
    ref: mail.messageId ?? `mail:${address ?? 'unknown'}:${mail.date?.toISOString() ?? ''}`,
    from: {
      key: `mail:${address ?? 'unknown'}`,
      name: sender?.name || null,
      phone: null,
      address,
    },
    to: [...addresses(mail.to), ...addresses(mail.cc)],
    subject: mail.subject ?? null,
    text: cleanMail(whole),
    ...(whole ? { original: whole } : {}),
    ...(inReplyTo ? { inReplyTo } : {}),
    ...(references.length > 0 ? { references } : {}),
    ...(options.direction === 'out' ? { direction: 'out' as const } : {}),
    attachments: mail.attachments.map((file) => ({
      name: file.filename ?? 'piece',
      mediaType: file.contentType ?? null,
      content: new Uint8Array(file.content),
    })),
    at: (mail.date ?? new Date()).toISOString(),
  };
}

/** A form's submission: who filled it (by her address or phone), and what she wrote. */
export function fromForm(submission: {
  ref: string;
  form: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  text: string;
  at?: Date;
}): Received {
  const address = submission.email ? lower(submission.email) : null;
  const phone = submission.phone?.replace(/[^\d]/g, '') || null;
  return {
    via: 'form',
    ref: submission.ref,
    from: {
      key: address ? `mail:${address}` : phone ? `whatsapp:${phone}` : `form:${submission.ref}`,
      name: submission.name ?? null,
      phone,
      address,
    },
    to: [],
    subject: submission.form,
    text: submission.text,
    attachments: [],
    at: (submission.at ?? new Date()).toISOString(),
  };
}
