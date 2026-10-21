import type { Routing } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { getThread, ThreadError, type Shown } from '@kete/threads';
import type { Mailbox, MailSender } from './mail.js';
import { fromMail, type Received } from './received.js';
import { rememberMail, route, type RouterOptions } from './router.js';

// Mail bridged into threads (spec 113, FR-004): a person's mailbox is read from where it stopped,
// each mail routed into its object's thread; an answer written in a thread leaves from her own box
// with the thread's address for replies — the answer to it comes back into the thread — and is
// kept in her Sent folder.

/**
 * Reads a mailbox's new mails, from one folder, and routes each; it resumes where it stopped the next
 * time (spec 140, FR-015). The INBOX by default; a Sent folder (`direction: 'out'`) gives what the
 * person wrote; the « Kete » folder what she put there. `accept` is the product's rule for a
 * personal box — a known contact, the « Kete » folder, a thread in copy: a mail it refuses is
 * never routed, nor kept.
 */
export async function readMailbox(
  db: SqlExecutor,
  organizationId: string,
  input: {
    key: string;
    mailbox: Mailbox;
    folder?: string;
    direction?: 'in' | 'out';
    accept?: (received: Received) => Promise<boolean>;
  },
  options: RouterOptions,
  now = new Date(),
): Promise<Routing[]> {
  const cursor = input.folder ? `${input.key}#${input.folder}` : input.key;
  const { rows } = await db.query<{ last_uid: string }>(
    `select last_uid from kete_mailbox_cursors where mailbox = $1`,
    [cursor],
  );
  const lastUid = Number(rows[0]?.last_uid ?? 0);
  const mails = await input.mailbox.fetchSince(lastUid, input.folder);
  const routed: Routing[] = [];
  for (const mail of mails) {
    const received = await fromMail(mail.source, { direction: input.direction ?? 'in' });
    if (input.accept && !(await input.accept(received))) continue;
    routed.push(await route(db, organizationId, received, options, now));
  }
  const reached = Math.max(lastUid, ...mails.map((mail) => mail.uid));
  await db.query(
    `insert into kete_mailbox_cursors (organization_id, mailbox, last_uid) values ($1, $2, $3)
     on conflict (organization_id, mailbox) do update set last_uid = excluded.last_uid`,
    [organizationId, cursor, reached],
  );
  return routed;
}

/**
 * Sends a message of a thread by mail, from her own box: to the thread's contacts reached by mail
 * (or those named), with the thread's address for replies, answering the last mail received in it.
 */
export async function answerByMail(
  db: SqlExecutor,
  input: {
    message: Pick<Shown, 'thread' | 'text'>;
    from: { name?: string; address: string };
    sender: MailSender;
    /** Her box, where the answer is kept in Sent. */
    mailbox?: Mailbox;
    to?: string[];
    /** Given, the answer is remembered: the reply to it finds this thread (spec 140, FR-014). */
    organizationId?: string;
  },
): Promise<{ messageId: string; to: string[] }> {
  const thread = await getThread(db, input.message.thread);
  if (!thread) throw new ThreadError('not_found', 'No such thread here.');
  const contacts = (thread.members ?? [])
    .filter((m) => m.kind === 'contact' && !m.until && m.id.startsWith('mail:'))
    .map((m) => m.id.slice('mail:'.length));
  const to = input.to ?? contacts;
  const { rows } = await db.query<{ ref: string }>(
    `select ref from kete_routings where thread_id = $1 and via = 'mail'
      order by at desc limit 1`,
    [thread.id],
  );
  const sent = await input.sender.send({
    from: input.from,
    to,
    subject: thread.title,
    text: input.message.text,
    ...(thread.address ? { replyTo: thread.address } : {}),
    ...(rows[0] ? { inReplyTo: rows[0].ref } : {}),
  });
  await input.mailbox?.appendSent(sent.source);
  if (input.organizationId) {
    await rememberMail(db, input.organizationId, {
      ref: sent.messageId,
      threadId: thread.id,
      direction: 'out',
    });
  }
  return { messageId: sent.messageId, to };
}
