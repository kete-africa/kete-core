import { type FormEvent, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Button, TextField } from '@kete/design';
import { authClient } from '@/lib/auth-client';
import { AuthFrame, Notice, safeRedirect, useHydrated } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/inscription')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeRedirect(search.redirect),
  }),
  component: SignUp,
});

function SignUp() {
  const hydrated = useHydrated();
  const { redirect } = Route.useSearch();
  const [error, setError] = useState<'refused' | 'rate_limited' | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: failure } = await authClient.signUp.email({
      name: String(form.get('name')),
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    if (failure) {
      // One message whatever the cause: it must not reveal whether an address has an account.
      setError(failure.status === 429 ? 'rate_limited' : 'refused');
      setPending(false);
      return;
    }
    window.location.assign(redirect ?? '/espace');
  }

  return (
    <AuthFrame title={m.auth_sign_up_title()} intro={m.auth_intro()}>
      <form method="post" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && (
          <Notice tone="error">
            {error === 'rate_limited' ? m.auth_error_rate_limited() : m.auth_error_sign_up()}
          </Notice>
        )}
        <TextField label={m.auth_name()} name="name" autoComplete="name" required />
        <TextField label={m.auth_email()} name="email" type="email" autoComplete="email" required />
        <TextField
          label={m.auth_password()}
          hint={m.auth_password_hint()}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <Button type="submit" disabled={pending || !hydrated}>
          {pending ? m.common_loading() : m.auth_sign_up_submit()}
        </Button>
      </form>
      <Notice tone="info">{m.auth_mail_notice()}</Notice>
      <p className="text-body-sm">
        {m.auth_has_account()}{' '}
        <Link
          to="/connexion"
          search={{ redirect }}
          className="font-semibold text-primary underline"
        >
          {m.auth_sign_in_submit()}
        </Link>
      </p>
    </AuthFrame>
  );
}
