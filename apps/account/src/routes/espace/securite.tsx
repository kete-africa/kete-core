import { type FormEvent, useState } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Button, Panel, Tag, TextField } from '@kete/design';
import QRCode from 'qrcode';
import { fetchSecurity } from '@/features/identity/functions';
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
  const { twoFactorEnabled } = Route.useLoaderData();
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
      <Panel title={m.security_two_factor()}>
        <div className="mb-4">
          <Tag tone={twoFactorEnabled ? 'validated' : 'neutral'}>
            {twoFactorEnabled ? m.security_enabled() : m.security_disabled()}
          </Tag>
        </div>

        {state === 'enabled' && <Notice tone="success">{m.security_now_enabled()}</Notice>}
        {state === 'disabled' && <Notice tone="success">{m.security_now_disabled()}</Notice>}
        {state === 'wrong_password' && <Notice tone="error">{m.security_wrong_password()}</Notice>}
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
    </div>
  );
}
