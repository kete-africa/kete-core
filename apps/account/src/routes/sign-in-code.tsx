import { type FormEvent, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button, TextField } from '@kete/design';
import { authClient, continueAfterSignIn } from '@/lib/auth-client';
import { AuthFrame, Notice, safeRedirect, useHydrated } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';

// The second step of a sign-in with two-factor authentication. The page keeps the query it was
// opened with: a Kete app's signed authorization request resumes once the code is right.
export const Route = createFileRoute('/connexion/code')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeRedirect(search.redirect),
  }),
  component: TwoFactorCode,
});

function TwoFactorCode() {
  const hydrated = useHydrated();
  const { redirect } = Route.useSearch();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get('code')).replace(/\s/g, '');
    const trustDevice = form.get('trust') === 'on';
    setPending(true);
    setError(false);
    // Six digits: the authenticator app; anything longer: a backup code.
    const { data, error: failure } = /^\d{6}$/.test(code)
      ? await authClient.twoFactor.verifyTotp({ code, trustDevice })
      : await authClient.twoFactor.verifyBackupCode({ code, trustDevice });
    if (failure) {
      setError(true);
      setPending(false);
      return;
    }
    continueAfterSignIn(data, redirect ?? '/espace');
  }

  return (
    <AuthFrame title={m.two_factor_code_title()} intro={m.two_factor_code_intro()}>
      <form method="post" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <Notice tone="error">{m.two_factor_invalid()}</Notice>}
        <TextField
          label={m.two_factor_code()}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
        />
        <label className="flex items-center gap-3 text-body-sm">
          <input type="checkbox" name="trust" className="size-5 accent-primary" />
          {m.two_factor_trust_device()}
        </label>
        <Button type="submit" disabled={pending || !hydrated}>
          {pending ? m.common_loading() : m.two_factor_verify()}
        </Button>
      </form>
    </AuthFrame>
  );
}
