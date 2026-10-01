import { type FormEvent, useState } from 'react';
import { createFileRoute, useLocation } from '@tanstack/react-router';
import { Button, TextField } from '@kete/design';
import { authClient, continueAfterSignIn } from '@/lib/auth-client';
import { AuthFrame, Notice, safeRedirect, useHydrated } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/connexion')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect: string | undefined; linkExpired?: true } => ({
    redirect: safeRedirect(search.redirect),
    // A one-time sign-in link that was used or expired (spec 013).
    ...(search.lien === 'expire' ? { linkExpired: true as const } : {}),
  }),
  component: SignIn,
});

function SignIn() {
  const hydrated = useHydrated();
  const { redirect, linkExpired } = Route.useSearch();
  // The raw query: a Kete app's signed authorization request must survive the switch.
  const searchStr = useLocation({ select: (location) => location.searchStr });
  const [error, setError] = useState<'refused' | 'rate_limited' | 'passkey' | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { data, error: failure } = await authClient.signIn.email({
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    if (failure) {
      setError(failure.status === 429 ? 'rate_limited' : 'refused');
      setPending(false);
      return;
    }
    continueAfterSignIn(data, redirect ?? '/espace');
  }

  // Spec 016: the browser or the password manager offers the person's passkey for this site.
  async function withPasskey() {
    setPending(true);
    setError(null);
    const result = await authClient.signIn.passkey();
    if (!result || result.error) {
      setError('passkey');
      setPending(false);
      return;
    }
    continueAfterSignIn(result.data, redirect ?? '/espace');
  }

  return (
    <AuthFrame title={m.auth_sign_in_title()} intro={m.auth_intro()}>
      <form method="post" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {linkExpired && !error && <Notice tone="error">{m.auth_link_expired()}</Notice>}
        {error && (
          <Notice tone="error">
            {error === 'rate_limited'
              ? m.auth_error_rate_limited()
              : error === 'passkey'
                ? m.auth_error_passkey()
                : m.auth_error_invalid()}
          </Notice>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={() => void withPasskey()}
          disabled={pending || !hydrated}
        >
          {m.auth_sign_in_passkey()}
        </Button>
        <p className="text-center text-body-sm text-bark">{m.auth_or_password()}</p>
        <TextField
          label={m.auth_email()}
          name="email"
          type="email"
          autoComplete="email webauthn"
          required
        />
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
        <a href="/forgot-password" className="text-body-sm text-primary underline">
          {m.auth_forgot_password()}
        </a>
      </form>
      <p className="text-body-sm">
        {m.auth_no_account()}{' '}
        <a href={`/inscription${searchStr}`} className="font-semibold text-primary underline">
          {m.auth_create_account()}
        </a>
      </p>
    </AuthFrame>
  );
}
