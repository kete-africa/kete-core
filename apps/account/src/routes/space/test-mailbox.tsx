import { createFileRoute } from '@tanstack/react-router';
import { Panel } from '@kete/design';
import { fetchTestMailbox } from '@/features/test-mailbox/functions';
import * as m from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

// « Boîte de test » (spec 132): what the Compte Kete would have sent in an environment without a
// mail provider, to any domain, for Kete's operators to follow a flow that needs an e-mail.
export const Route = createFileRoute('/espace/boite-de-test')({
  loader: () => fetchTestMailbox(),
  component: TestMailbox,
});

const when = (iso: string) =>
  new Intl.DateTimeFormat(getLocale(), { dateStyle: 'short', timeStyle: 'medium' }).format(
    new Date(iso),
  );

/** The e-mail's words, its links clickable. */
function Words({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"]+)/g);
  return (
    <p className="whitespace-pre-wrap break-words text-body-sm">
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a key={index} href={part} className="break-all font-semibold underline">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}

function TestMailbox() {
  const { mails } = Route.useLoaderData();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-headline text-headline font-extrabold">{m.test_mailbox_title()}</h1>
        <p className="text-body-lg text-bark">{m.test_mailbox_intro()}</p>
      </div>
      {mails.length === 0 ? (
        <p className="text-bark">{m.test_mailbox_empty()}</p>
      ) : (
        mails.map((mail) => (
          <Panel key={mail.id} title={mail.subject}>
            <div className="flex flex-col gap-2">
              <p className="text-body-sm text-bark">
                {m.test_mailbox_to({ to: mail.to, at: when(mail.at) })}
              </p>
              <Words text={mail.text} />
            </div>
          </Panel>
        ))
      )}
    </div>
  );
}
