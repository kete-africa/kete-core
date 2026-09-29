import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@kete/design';
import { authClient } from '@/lib/auth-client';
import { AuthFrame, Notice, useHydrated } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';

// Kete's own apps are trusted clients and never come here. This page answers any other
// registered client that asks for consent: the person accepts or refuses, nothing is assumed.
export const Route = createFileRoute('/consentement')({
  validateSearch: (search: Record<string, unknown>) => ({
    client_id: typeof search.client_id === 'string' ? search.client_id : '',
    scope: typeof search.scope === 'string' ? search.scope : '',
  }),
  component: Consent,
});

function Consent() {
  const hydrated = useHydrated();
  const { client_id: clientId } = Route.useSearch();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function answer(accept: boolean) {
    setPending(true);
    setError(false);
    const { data, error: failure } = await authClient.$fetch<{ url?: string }>('/oauth2/consent', {
      method: 'POST',
      body: { accept },
    });
    if (failure || !data?.url) {
      setError(true);
      setPending(false);
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <AuthFrame title={m.consent_title()} intro={m.consent_text({ client: clientId })}>
      {error && <Notice tone="error">{m.error_generic()}</Notice>}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void answer(true)} disabled={pending || !hydrated}>
          {m.consent_accept()}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void answer(false)}
          disabled={pending || !hydrated}
        >
          {m.consent_deny()}
        </Button>
      </div>
    </AuthFrame>
  );
}
