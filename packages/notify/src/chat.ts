/**
 * The port of chat channels (WhatsApp, Telegram…): how a product speaks to a person where she
 * already is (doctrine PRINCIPES 7), and how it hears her. The adapters of this package
 * (`whatsapp.ts`, `telegram.ts`) are its only vendors; the business code never names one.
 */
export type ChatChannelName = 'whatsapp' | 'telegram';

/** A button the person can press, answered as an action. */
export interface ChatAction {
  id: string;
  label: string;
}

/**
 * Who a channel proves the sender is — never what a message claims. A channel may hide a person's
 * phone number: look her up by `phone` when it is there, by `id` otherwise, and keep both.
 */
export interface ChatSender {
  /** The channel's own stable identifier of the person for this business. Always present. */
  id: string;
  /** Her phone number in digits, when the channel gives it. */
  phone: string | null;
  /** What `sendText` and the other gestures take to answer her. */
  address: string;
  username: string | null;
  displayName: string | null;
}

/** A file a person sent, to be fetched with `download`. */
export interface ChatMedia {
  id: string;
  mediaType: string | null;
  filename: string | null;
}

/** A message as a channel proved it. */
export interface ChatInbound {
  channel: ChatChannelName;
  /** The provider's identifier of the message: a channel may deliver twice, an app hears once. */
  providerMessageId: string;
  sender: ChatSender;
  kind: 'text' | 'voice' | 'photo' | 'document' | 'contact' | 'action' | 'unsupported';
  text?: string | null;
  media?: ChatMedia | null;
  /** A number she shared; `own` when the channel says it is hers. */
  contact?: { phoneNumber: string; own: boolean } | null;
  /** The button she pressed (its id). */
  action?: string | null;
}

/** A message a channel refused, and why — in words a product can act on. */
export class ChatChannelError extends Error {
  constructor(
    readonly reason:
      | 'outside_window'
      | 'recipient_unreachable'
      | 'needs_phone_number'
      | 'provider_refused'
      | 'network',
    detail = '',
  ) {
    super(detail || reason);
    this.name = 'ChatChannelError';
  }
}

/** A message a business sends first, where a channel only lets it through an approved template. */
export interface ChatTemplate {
  name: string;
  language: string;
  /** The values of its body, in order. */
  parameters: string[];
}

/** What a channel knows of a message that left: its own identifier, which a status names later. */
export interface ChatReceipt {
  providerMessageId: string;
}

/** A receipt, or nothing: an adapter that answers nothing still satisfies the port. */
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- an adapter may answer nothing
export type ChatSendResult = ChatReceipt | void;

/** What a provider says later of a message that left: where it is, and whether it was billed. */
export interface ChatStatus {
  providerMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  /** Why it failed, in the words of `ChatChannelError`. */
  reason: ChatChannelError['reason'] | null;
  /** Whether the provider bills it, when it says so. */
  billable: boolean | null;
  /** The provider’s category of cost (« utility », « marketing », « service »…), when it says so. */
  category: string | null;
}

export interface ChatChannel {
  readonly channel: ChatChannelName;
  sendText(to: string, text: string, actions?: ChatAction[]): Promise<ChatSendResult>;
  sendDocument(
    to: string,
    content: Uint8Array,
    filename: string,
    caption: string,
  ): Promise<ChatSendResult>;
  /** Some channels only let a business write first with an approved template. */
  sendTemplate?(to: string, template: ChatTemplate): Promise<ChatSendResult>;
  /** A list to choose from; a chosen row comes back as an action with its id. */
  sendList?(
    to: string,
    text: string,
    buttonLabel: string,
    rows: { id: string; title: string; description: string }[],
  ): Promise<void>;
  /** Asks her number, where the channel does not give it. */
  askForContact?(to: string, text: string, buttonLabel: string): Promise<void>;
  download?(media: ChatMedia): Promise<{ bytes: Uint8Array; mediaType: string }>;
  /** Acknowledges a pressed button, where the channel expects it. */
  acknowledgeAction?(message: ChatInbound): Promise<void>;
  /**
   * Shows that an answer is being written while the product works on her message; returns the way
   * to stop it. Never fails the turn.
   */
  typing?(message: ChatInbound): () => void;
}

/** The channels of a deployment: connected, or not (null) — never simulated. */
export type ChatChannels = Record<ChatChannelName, ChatChannel | null>;

/** What a webhook answers, and what it heard. The answer is returned even when nothing was heard. */
export interface ChatHeard {
  response: Response;
  messages: ChatInbound[];
}

/** What left through a memory channel. */
export type ChatSent =
  | { kind: 'text'; to: string; text: string; actions: ChatAction[] }
  | { kind: 'document'; to: string; filename: string; caption: string; bytes: number }
  | { kind: 'template'; to: string; template: ChatTemplate };

/** Keeps what would have left: for tests, never a live channel. */
export function memoryChatChannel(channel: ChatChannelName): ChatChannel & { sent: ChatSent[] } {
  const sent: ChatSent[] = [];
  // Each message gets an identifier, as a provider would give one.
  const receipt = () => Promise.resolve({ providerMessageId: `mem_${channel}_${sent.length}` });
  return {
    channel,
    sent,
    sendText(to, text, actions) {
      sent.push({ kind: 'text', to, text, actions: actions ?? [] });
      return receipt();
    },
    sendDocument(to, content, filename, caption) {
      sent.push({ kind: 'document', to, filename, caption, bytes: content.byteLength });
      return receipt();
    },
    sendTemplate(to, template) {
      sent.push({ kind: 'template', to, template });
      return receipt();
    },
  };
}

// --- What the adapters share ---------------------------------------------------------------------

export type Json = Record<string, unknown>;
export const record = (value: unknown): Json =>
  value && typeof value === 'object' ? (value as Json) : {};
export const list = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);
/** A value a provider may send as a string or a number; anything else is absent. */
export const text = (value: unknown): string | null =>
  typeof value === 'string' && value !== ''
    ? value
    : typeof value === 'number'
      ? String(value)
      : null;

const mediaTypes: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
};

/** The media type a file's name announces; an unknown one travels as bytes. */
export function mediaTypeOf(filename: string): string {
  const extension = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  return mediaTypes[extension] ?? 'application/octet-stream';
}

/** What a person said in a message: her words, or what she said in a voice note, written down. */
export interface ChatWords {
  text: string;
  from: 'text' | 'voice';
}

/**
 * The words of a message (kete-core spec 104): a text as it is, a voice note fetched from its
 * channel and written down by the dictation port (`dictation` of `@kete/ai`); anything else, or a
 * voice note nothing could hear, has none. Each channel's media, the same way.
 */
export async function wordsOf(
  message: ChatInbound,
  options: {
    channel: Pick<ChatChannel, 'download'>;
    dictate: (audio: Uint8Array) => Promise<{ text: string }>;
  },
): Promise<ChatWords | null> {
  if (message.kind === 'text') {
    const text = message.text?.trim();
    return text ? { text, from: 'text' } : null;
  }
  if (message.kind !== 'voice' || !message.media || !options.channel.download) return null;
  const { bytes } = await options.channel.download(message.media);
  const heard = (await options.dictate(bytes)).text.trim();
  return heard ? { text: heard, from: 'voice' } : null;
}
