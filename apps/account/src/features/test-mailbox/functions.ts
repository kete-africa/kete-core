import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { actorFromHeaders, ForbiddenError } from '@/platform/actor';
import { keptMails, testMailboxOpenTo } from './mailbox.server';

// « Boîte de test » (spec 132): in an environment without a mail provider, what the Compte Kete
// would have sent — an invitation, a new password's link — to any domain, read by Kete's operators
// only, so the flows that need an e-mail are tried end to end. Never in production.

export const fetchTestMailbox = createServerFn({ method: 'GET' }).handler(async () => {
  const actor = await actorFromHeaders(getRequestHeaders());
  if (!actor || !(await testMailboxOpenTo(actor.userId))) throw new ForbiddenError('forbidden');
  return { mails: keptMails() };
});
