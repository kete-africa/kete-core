// The public entry point of @kete/channels. Anything not exported here is internal.

export {
  imapMailbox,
  memoryMailbox,
  memorySender,
  smtpSender,
  type MailAccount,
  type Mailbox,
  type MailSender,
  type OutgoingMail,
} from './mail.js';
export { answerByMail, readMailbox } from './mailboxes.js';
export { answerByChat, WHATSAPP_WINDOW_HOURS, type ChatAnswer } from './chat-answers.js';
export {
  channelsMailRefsMigrationSql,
  channelsMigrationSql,
  type ChannelsMigrationOptions,
} from './migration.js';
export {
  cleanMail,
  fromChat,
  fromForm,
  fromMail,
  fromMail as fromEml,
  type Received,
  type ReceivedAttachment,
  type Via,
} from './received.js';
export {
  addRoutingRule,
  rememberMail,
  route,
  RouterError,
  settle,
  type ObjectRef,
  type Reading,
  type RouterOptions,
} from './router.js';
