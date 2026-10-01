/**
 * The port of chat channels (WhatsApp, Telegram…): how a product speaks to a person where she
 * already is (doctrine PRINCIPES 7). Written from Firmo's channels, which provide its first
 * adapters; the business code never names the vendor.
 */
export type ChatChannelName = 'whatsapp' | 'telegram';

/** A button the person can press, answered as an action. */
export interface ChatAction {
  id: string;
  label: string;
}

export interface ChatChannel {
  readonly channel: ChatChannelName;
  sendText(to: string, text: string, actions?: ChatAction[]): Promise<void>;
  sendDocument(to: string, content: Uint8Array, filename: string, caption: string): Promise<void>;
}
