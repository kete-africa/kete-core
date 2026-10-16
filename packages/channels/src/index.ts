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
export { channelsMigrationSql, type ChannelsMigrationOptions } from './migration.js';
export {
  fromChat,
  fromForm,
  fromMail,
  type Received,
  type ReceivedAttachment,
  type Via,
} from './received.js';
export {
  addRoutingRule,
  route,
  RouterError,
  settle,
  type ObjectRef,
  type Reading,
  type RouterOptions,
} from './router.js';
