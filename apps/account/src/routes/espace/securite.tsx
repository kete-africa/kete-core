import { type FormEvent, useState } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Button, Panel, Tag, TextField } from '@kete/design';
import QRCode from 'qrcode';
import { fetchSecurity, removeMyPassword } from '@/features/identity/functions';
import { authClient } from '@/lib/auth-client';
import { Notice, useHydrated } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/espace/securite')({
  loader: () => fetchSecurity(),
  component: Security,
});

interface Enrollment {
  qr: string;
  secret: string;
  backupCodes: string[];
}

function Security() {
  const { twoFactorEnabled, password, passkeys } = Route.useLoaderData();
  const router = useRouter();
  const hydrated = useHydrated();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [state, setState] = useState<
    'idle' | 'pending' | 'wrong_password' | 'wrong_code' | 'enabled' | 'disabled'
  >('idle');

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password'));
    setState('pending');
    const { data, error } = await authClient.twoFactor.enable({ password });
    // TOTP is the only method configured; anything else is refused.
    if (error || !data || data.method !== 'totp') {
      setState('wrong_password');
      return;
    }
    const secret = new URL(data.totpURI).searchParams.get('secret') ?? '';
    setEnrollment({
      qr: await QRCode.toDataURL(data.totpURI, { margin: 1, width: 200 }),
      secret,
      backupCodes: data.backupCodes,
    });
    setState('idle');
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code')).replace(/\s/g, '');
    setState('pending');
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    if (error) {
      setState('wrong_code');
      return;
    }
    setEnrollment(null);
    setState('enabled');
    await router.invalidate();
  }

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password'));
    setState('pending');
    const { error } = await authClient.twoFactor.disable({ password });
    if (error) {
      setState('wrong_password');
      return;
    }
    setState('disabled');
    await router.invalidate();
  }

  const busy = state === 'pending' || !hydrated;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-headline text-headline font-extrabold">{m.security_title()}</h1>
        <p className="text-body-lg text-bark">{m.security_intro()}</p>
      </div>
      <Passkeys passkeys={passkeys} password={password} />
      {password && (
        <Panel title={m.security_two_factor()}>
          <div className="mb-4">
            <Tag tone={twoFactorEnabled ? 'validated' : 'neutral'}>
              {twoFactorEnabled ? m.security_enabled() : m.security_disabled()}
            </Tag>
          </div>

          {state === 'enabled' && <Notice tone="success">{m.security_now_enabled()}</Notice>}
          {state === 'disabled' && <Notice tone="success">{m.security_now_disabled()}</Notice>}
          {state === 'wrong_password' && (
            <Notice tone="error">{m.security_wrong_password()}</Notice>
          )}
          {state === 'wrong_code' && <Notice tone="error">{m.two_factor_invalid()}</Notice>}

          {enrollment ? (
            <form method="post" onSubmit={confirm} className="mt-4 flex flex-col gap-4 sm:max-w-md">
              <p className="text-body-sm">{m.security_scan()}</p>
              <img src={enrollment.qr} alt={m.security_qr_alt()} width={200} height={200} />
              <p className="break-all font-number text-body-sm">
                {m.security_secret({ secret: enrollment.secret })}
              </p>
              <div>
                <p className="text-body-sm font-semibold">{m.security_backup_codes()}</p>
                <ul className="mt-2 grid grid-cols-2 gap-1 font-number text-body-sm">
                  {enrollment.backupCodes.map((code) => (
                    <li key={code}>{code}</li>
                  ))}
                </ul>
              </div>
              <TextField
                label={m.two_factor_code()}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
              <Button type="submit" disabled={busy}>
                {m.security_confirm()}
              </Button>
            </form>
          ) : (
            <form
              method="post"
              onSubmit={twoFactorEnabled ? disable : start}
              className="mt-4 flex flex-col gap-4 sm:max-w-md"
            >
              <TextField
                label={m.security_password()}
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
              <Button
                type="submit"
                variant={twoFactorEnabled ? 'secondary' : 'primary'}
                disabled={busy}
              >
                {twoFactorEnabled ? m.security_disable() : m.security_enable()}
              </Button>
            </form>
          )}
        </Panel>
      )}
    </div>
  );
}

/**
 * Spec 016: passkeys, kept by the person's password manager or device. Once she has one, she may
 * drop her password — her account then signs in with a passkey only, which counts as strong.
 */
function Passkeys({
  passkeys,
  password,
}: {
  passkeys: { id: string; name: string | null; createdAt: string | null }[];
  password: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [state, setState] = useState<
    'idle' | 'pending' | 'added' | 'refused' | 'removed' | 'password_removed' | 'last_passkey'
  >('idle');
  const busy = state === 'pending' || !hydrated;

  async function add() {
    setState('pending');
    const result = await authClient.passkey.addPasskey({ name: m.security_passkey_default_name() });
    if (!result || result.error) {
      setState('refused');
      return;
    }
    setState('added');
    await router.invalidate();
  }

  async function remove(id: string) {
    setState('pending');
    const { error } = await authClient.passkey.deletePasskey({ id });
    if (error) {
      setState(error.status === 403 ? 'last_passkey' : 'refused');
      return;
    }
    setState('removed');
    await router.invalidate();
  }

  async function dropPassword() {
    if (!window.confirm(m.security_password_remove_confirm())) return;
    setState('pending');
    // The passkey is used right now: removing the password needs this fresh proof.
    const signedIn = await authClient.signIn.passkey();
    if (!signedIn || signedIn.error) {
      setState('refused');
      return;
    }
    const outcome = await removeMyPassword();
    if (!outcome.ok) {
      setState('refused');
      return;
    }
    setState('password_removed');
    await router.invalidate();
  }

  return (
    <Panel title={m.security_passkeys()}>
      <p className="mb-4 text-body-sm text-bark">{m.security_passkeys_intro()}</p>
      {state === 'added' && <Notice tone="success">{m.security_passkey_added()}</Notice>}
      {state === 'removed' && <Notice tone="success">{m.security_passkey_removed()}</Notice>}
      {state === 'password_removed' && (
        <Notice tone="success">{m.security_password_removed()}</Notice>
      )}
      {state === 'refused' && <Notice tone="error">{m.security_passkey_refused()}</Notice>}
      {state === 'last_passkey' && <Notice tone="error">{m.security_last_passkey()}</Notice>}
      {passkeys.length > 0 && (
        <ul className="my-4 flex flex-col gap-2">
          {passkeys.map((key) => (
            <li key={key.id} className="flex items-center justify-between gap-3">
              <span className="text-body-sm">
                {key.name || m.security_passkey_default_name()}
                {key.createdAt ? ` · ${key.createdAt.slice(0, 10)}` : ''}
              </span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void remove(key.id)}
                disabled={busy}
              >
                {m.security_passkey_remove()}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-3 sm:max-w-md">
        <Button type="button" onClick={() => void add()} disabled={busy}>
          {m.security_passkey_add()}
        </Button>
        {password && passkeys.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => void dropPassword()}
            disabled={busy}
          >
            {m.security_password_remove()}
          </Button>
        )}
        {!password && <p className="text-body-sm">{m.security_passkey_only()}</p>}
      </div>
    </Panel>
  );
}
