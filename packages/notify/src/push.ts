import webpush from 'web-push';
import type { PushSubscriptionInput } from './inbox.js';

// Web Push (spec 055): a notification on the person's phone or computer, even when the product is
// closed, through the browser's own push service — the standard, with VAPID keys, through the
// `web-push` library. One port; a memory sender for tests.

export interface PushMessage {
  title: string;
  body: string;
  /** Where a tap opens. */
  href: string;
  /** Notifications with the same tag replace one another on the device. */
  tag?: string;
}

/** `gone`: the push service no longer knows the device; it is forgotten. */
export type PushOutcome = 'sent' | 'gone' | 'failed';

export interface PushSender {
  /** The public key a browser subscribes with. */
  readonly publicKey: string;
  send(device: PushSubscriptionInput, message: PushMessage): Promise<PushOutcome>;
}

export function webPushSender(options: {
  publicKey: string;
  privateKey: string;
  /** A `mailto:` or https address the push services may contact. */
  subject: string;
}): PushSender {
  const details = {
    subject: options.subject,
    publicKey: options.publicKey,
    privateKey: options.privateKey,
  };
  return {
    publicKey: options.publicKey,
    async send(device, message) {
      try {
        await webpush.sendNotification(device, JSON.stringify(message), {
          vapidDetails: details,
          TTL: 60 * 60 * 24,
          urgency: 'normal',
        });
        return 'sent';
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        return status === 404 || status === 410 ? 'gone' : 'failed';
      }
    },
  };
}

/**
 * The sender the environment names (`KETE_VAPID_PUBLIC_KEY`, `KETE_VAPID_PRIVATE_KEY`,
 * `KETE_VAPID_SUBJECT`); null when push is not configured: notifications stay in the product.
 */
export function pushSenderFromEnv(env: NodeJS.ProcessEnv = process.env): PushSender | null {
  const publicKey = env.KETE_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.KETE_VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return webPushSender({
    publicKey,
    privateKey,
    subject: env.KETE_VAPID_SUBJECT?.trim() || 'mailto:support@kete.africa',
  });
}

/** A new pair of VAPID keys, for an instance's configuration. */
export function generatePushKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys();
}

/** Tests: keeps what would be sent; endpoints listed in `gone` answer as forgotten devices. */
export function memoryPushSender(
  gone: string[] = [],
): PushSender & { sent: { endpoint: string; message: PushMessage }[] } {
  const sent: { endpoint: string; message: PushMessage }[] = [];
  return {
    publicKey: 'BMemoryPublicKey',
    sent,
    async send(device, message) {
      if (gone.includes(device.endpoint)) return 'gone';
      sent.push({ endpoint: device.endpoint, message });
      return 'sent';
    },
  };
}
