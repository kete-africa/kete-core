import { type FormEvent, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Button, TextField } from '@kete/design';
import { authClient } from '@/lib/auth-client';
import { AuthFrame, Notice, safeRedirect, useHydrated } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/connexion')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeRedirect(search.redirect),
  }),
  component: SignIn,
});

function SignIn() {
  const hydrated = useHydrated();
  const { redirect } = Route.useSearch();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(false);
    const { error: failure } = await authClient.signIn.email({
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    if (failure) {
      setError(true);
      setPending(false);
      return;
    }
    window.location.assign(redirect ?? '/espace');
  }

  return (
    <AuthFrame title={m.auth_sign_in_title()} intro={m.auth_intro()}>
      <form method="post" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <Notice tone="error">{m.auth_error_invalid()}</Notice>}
        <TextField label={m.auth_email()} name="email" type="email" autoComplete="email" required />
        <TextField
          label={m.auth_password()}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" disabled={pending || !hydrated}>
          {pending ? m.common_loading() : m.auth_sign_in_submit()}
        </Button>
      </form>
      <p className="text-body-sm">
        {m.auth_no_account()}{' '}
        <Link
          to="/inscription"
          search={{ redirect }}
          className="font-semibold text-primary underline"
        >
          {m.auth_create_account()}
        </Link>
      </p>
    </AuthFrame>
  );
}
