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
