import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button, Panel, Tag } from '@kete/design';
import { fetchSwitch } from '@/features/identity/functions';
import { authClient } from '@/lib/auth-client';
import * as m from '@/paraglide/messages.js';

// Changing organization on the way back to an app (Kete Enterprise spec 098, FR-001): an app that
// opened in an organization with nothing for it sends her here; she chooses, the Compte Kete makes it
// her active organization and sends her back to the app, which signs her in again in it.
export const Route = createFileRoute('/espace/changer')({
  validateSearch: (search: Record<string, unknown>): { retour?: string } =>
    typeof search.retour === 'string' ? { retour: search.retour } : {},
  loaderDeps: ({ search }) => ({ retour: search.retour }),
  loader: ({ deps }) => fetchSwitch({ data: deps.retour ? { retour: deps.retour } : {} }),
  component: Switch,
});

function Switch() {
  const { current, organizations, back } = Route.useLoaderData();
  const [busy, setBusy] = useState<string | null>(null);

  async function choose(organizationId: string) {
    setBusy(organizationId);
    if (organizationId !== current) await authClient.organization.setActive({ organizationId });
    window.location.assign(back ?? '/espace');
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-headline font-semibold">{m.switch_title()}</h1>
        <p className="text-bark">{back ? m.switch_intro_back() : m.switch_intro()}</p>
      </div>
      <Panel>
        <ul className="flex flex-col divide-y divide-rule">
          {organizations.map((org) => (
            <li key={org.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-2 font-semibold">
                {org.name}
                {org.id === current && <Tag tone="info">{m.switch_current()}</Tag>}
              </span>
              <Button
                variant={org.id === current ? 'secondary' : 'primary'}
                disabled={busy !== null}
                onClick={() => void choose(org.id)}
              >
                {org.id === current && back ? m.switch_stay() : m.switch_choose()}
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
