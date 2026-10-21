import type { ChatChannels, ChatTemplate } from '@kete/notify';
import type { SqlExecutor } from '@kete/tenancy';
import { getThread, ThreadError, type Shown } from '@kete/threads';

// Answers to a thread's contacts on WhatsApp and Telegram (spec 139, FR-008). WhatsApp lets a
// business write freely only within 24 hours of the person's last message; after that, only an
// approved template goes through. Telegram has no such window. An answer never leaves another way
// than the person chose to write.

/** Meta's customer service window. */
export const WHATSAPP_WINDOW_HOURS = 24;

export interface ChatAnswer {
  /** Contacts reached with the words themselves. */
  sent: string[];
  /** Contacts reached through the organization's template, outside the window. */
  byTemplate: string[];
  /** Contacts not reached, and why. */
  refused: { to: string; reason: 'outside_window' | 'no_channel' }[];
}

const chatContact = /^(whatsapp|telegram):(.+)$/;

/**
 * Sends a thread's outside message to its contacts on WhatsApp and Telegram. Within WhatsApp's
 * window the words go as they are; outside it, through `template` when the organization chose one,
 * else that contact is refused with the reason.
 */
export async function answerByChat(
  db: SqlExecutor,
  input: {
    message: Pick<Shown, 'thread' | 'text'>;
    channels: ChatChannels;
    /** The organization's approved template for a follow-up, filled from the words; none: refused. */
    template?: ((text: string) => ChatTemplate) | null;
    now?: Date;
  },
): Promise<ChatAnswer> {
  const thread = await getThread(db, input.message.thread);
  if (!thread) throw new ThreadError('not_found', 'No such thread here.');
  const now = input.now ?? new Date();
  const answer: ChatAnswer = { sent: [], byTemplate: [], refused: [] };
  const contacts = (thread.members ?? []).filter(
    (m) => m.kind === 'contact' && !m.until && chatContact.test(m.id),
  );
  for (const contact of contacts) {
    const [, via, address] = chatContact.exec(contact.id) as RegExpExecArray;
    const channel = input.channels[via as 'whatsapp' | 'telegram'];
    if (!channel || !address) {
      answer.refused.push({ to: contact.id, reason: 'no_channel' });
      continue;
    }
    if (via === 'telegram') {
      await channel.sendText(address, input.message.text);
      answer.sent.push(contact.id);
      continue;
    }
    // Her last words to the organization, in any of its threads: the window is the number's.
    const { rows } = await db.query<{ last: Date | null }>(
      `select max(at) as last from kete_messages where author_kind = 'contact' and author_id = $1`,
      [contact.id],
    );
    const last = rows[0]?.last ? new Date(rows[0].last) : null;
    const open = last !== null && now.getTime() - last.getTime() < WHATSAPP_WINDOW_HOURS * 3600_000;
    if (open) {
      await channel.sendText(address, input.message.text);
      answer.sent.push(contact.id);
    } else if (input.template && channel.sendTemplate) {
      await channel.sendTemplate(address, input.template(input.message.text));
      answer.byTemplate.push(contact.id);
    } else {
      answer.refused.push({ to: contact.id, reason: 'outside_window' });
    }
  }
  return answer;
}
