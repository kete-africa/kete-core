import type { Routing } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { getThread, ThreadError, type Shown } from '@kete/threads';
import type { Mailbox, MailSender } from './mail.js';
import { fromMail } from './received.js';
import { route, type RouterOptions } from './router.js';

// Mail bridged into threads (spec 113, FR-004): a person's mailbox is read from where it stopped,
// each mail routed into its object's thread; an answer written in a thread leaves from her own box
// with the thread's address for replies — the answer to it comes back into the thread — and is
// kept in her Sent folder.

/** Reads a mailbox's new mails and routes each; it resumes where it stopped the next time. */
export async function readMailbox(
  db: SqlExecutor,
  organizationId: string,
  input: { key: string; mailbox: Mailbox },
  options: RouterOptions,
  now = new Date(),
): Promise<Routing[]> {
  const { rows } = await db.query<{ last_uid: string }>(
    `select last_uid from kete_mailbox_cursors where mailbox = $1`,
    [input.key],
  );
  const lastUid = Number(rows[0]?.last_uid ?? 0);
  const mails = await input.mailbox.fetchSince(lastUid);
  const routed: Routing[] = [];
  for (const mail of mails) {
    routed.push(await route(db, organizationId, await fromMail(mail.source), options, now));
  }
  const reached = Math.max(lastUid, ...mails.map((mail) => mail.uid));
  await db.query(
    `insert into kete_mailbox_cursors (organization_id, mailbox, last_uid) values ($1, $2, $3)
     on conflict (organization_id, mailbox) do update set last_uid = excluded.last_uid`,
    [organizationId, input.key, reached],
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
  return { messageId: sent.messageId, to };
}
