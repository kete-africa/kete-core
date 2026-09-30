import { type FormEvent, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button, TextField } from '@kete/design';
import { authClient } from '@/lib/auth-client';
import { AuthFrame, Notice, useHydrated } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';

// Spec 025: the link of the e-mail lands here with its token (or `error=INVALID_TOKEN` when it is
// used or expired). Saving the new password closes every other session.
export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>): { token?: string; invalid?: true } => ({
    ...(typeof search.token === 'string' && search.token ? { token: search.token } : {}),
    ...(search.error ? { invalid: true as const } : {}),
  }),
  component: NewPassword,
});

function NewPassword() {
  const hydrated = useHydrated();
  const { token, invalid } = Route.useSearch();
  const [state, setState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    setState('pending');
    const { error } = await authClient.resetPassword({
      newPassword: String(form.get('password')),
      token,
    });
    setState(error ? 'error' : 'done');
  }

  const usable = Boolean(token) && !invalid;

  return (
    <AuthFrame title={m.reset_title()} {...(usable ? { intro: m.reset_intro() } : {})}>
      {!usable && <Notice tone="error">{m.reset_invalid()}</Notice>}
      {state === 'done' && <Notice tone="success">{m.reset_done()}</Notice>}
      {usable && state !== 'done' && (
        <form method="post" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {state === 'error' && <Notice tone="error">{m.reset_error()}</Notice>}
          <TextField
            label={m.reset_new_password()}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
          <Button type="submit" disabled={state === 'pending' || !hydrated}>
            {state === 'pending' ? m.common_loading() : m.reset_submit()}
          </Button>
        </form>
      )}
      <p className="text-body-sm">
        <a
          href={usable || state === 'done' ? '/connexion' : '/forgot-password'}
          className="font-semibold text-primary underline"
        >
          {usable || state === 'done' ? m.reset_back_to_sign_in() : m.forgot_submit()}
        </a>
      </p>
    </AuthFrame>
  );
}
