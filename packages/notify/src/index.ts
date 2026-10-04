// The public entry point of @kete/notify. Anything not exported here is internal.

export type { ChatAction, ChatChannel, ChatChannelName } from './chat.js';
export {
  checkEmail,
  EmailError,
  isEmailAddress,
  type EmailAttachment,
  type EmailSender,
  type OutgoingEmail,
  type SentEmail,
} from './email.js';
export {
  mailkiteSender,
  verifyMailkiteSignature,
  type MailkiteOptions,
  type MailkiteSignature,
} from './mailkite.js';
export {
  createMailer,
  defineEmailTemplate,
  renderEmail,
  type EmailTemplate,
  type Mailer,
  type MailerOptions,
} from './mailer.js';
export { emailSenderFromEnv, logSender, memorySender } from './senders.js';
export {
  listNotifications,
  markRead,
  notificationsMigrationSql,
  notify,
  pushSubscriptionsOf,
  removePushSubscription,
  savePushSubscription,
  unreadCount,
  type Notification,
  type NotificationInput,
  type NotificationsMigrationOptions,
  type PushSubscriptionInput,
} from './inbox.js';
export {
  generatePushKeys,
  memoryPushSender,
  pushSenderFromEnv,
  webPushSender,
  type PushMessage,
  type PushOutcome,
  type PushSender,
} from './push.js';
