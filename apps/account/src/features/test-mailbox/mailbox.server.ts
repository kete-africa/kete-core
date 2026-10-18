import { testMails } from '@/platform/email';
import { isOperator } from '@/platform/operators';

// « Boîte de test » (spec 132), server side only: what the test mailbox kept, and who may read it.

/** Whether the test mailbox is open to this person: it is on, and she is an operator. */
export async function testMailboxOpenTo(userId: string): Promise<boolean> {
  return testMails() !== null && (await isOperator(userId));
}

/** The kept e-mails, as the page shows them. */
export function keptMails() {
  return (testMails() ?? []).map((mail) => ({
    id: mail.id,
    at: mail.at,
    to: Array.isArray(mail.to) ? mail.to.join(', ') : mail.to,
    subject: mail.subject,
    text: mail.text,
  }));
}
