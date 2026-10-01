import { type FormEvent, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button, TextField } from '@kete/design';
import { authClient } from '@/lib/auth-client';
import { AuthFrame, Notice, useHydrated } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';

// Spec 025: the person asks for a link to choose a new password. The answer never says whether an
// account exists at the address.
export const Route = createFileRoute('/forgot-password')({ component: ForgotPassword });

function ForgotPassword() {
  const hydrated = useHydrated();
  const [state, setState] = useState<'idle' | 'pending' | 'sent' | 'rate_limited'>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState('pending');
    const { error } = await authClient.requestPasswordReset({
      email: String(form.get('email')),
      redirectTo: '/reset-password',
    });
    setState(error?.status === 429 ? 'rate_limited' : 'sent');
  }

  return (
    <AuthFrame title={m.forgot_title()} intro={m.forgot_intro()}>
      {state === 'sent' ? (
        <Notice tone="success">{m.forgot_sent()}</Notice>
      ) : (
        <form method="post" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {state === 'rate_limited' && <Notice tone="error">{m.auth_error_rate_limited()}</Notice>}
          <TextField
            label={m.auth_email()}
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <Button type="submit" disabled={state === 'pending' || !hydrated}>
            {state === 'pending' ? m.common_loading() : m.forgot_submit()}
          </Button>
        </form>
      )}
      <p className="text-body-sm">
        <a href="/connexion" className="font-semibold text-primary underline">
          {m.reset_back_to_sign_in()}
        </a>
      </p>
    </AuthFrame>
  );
}
