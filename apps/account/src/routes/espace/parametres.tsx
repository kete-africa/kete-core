import { type FormEvent, useState } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Button, Panel, TextField } from '@kete/design';
import { LogoPanel } from '@/features/files/LogoPanel';
import { fetchSettings, updateSettings } from '@/features/settings/functions';
import { Notice, SelectField, useHydrated } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/espace/parametres')({
  loader: () => fetchSettings(),
  component: Settings,
});

const timeZones = [
  'Africa/Lome',
  'Africa/Abidjan',
  'Africa/Accra',
  'Africa/Bamako',
  'Africa/Dakar',
  'Africa/Douala',
  'Africa/Kinshasa',
  'Africa/Lagos',
  'Africa/Niamey',
  'Africa/Ouagadougou',
  'Africa/Porto-Novo',
  'Europe/Paris',
  'UTC',
];
const currencies = ['XOF', 'XAF', 'GHS', 'NGN', 'EUR', 'USD'];
const channels = [
  { id: 'email', label: m.channel_email },
  { id: 'whatsapp', label: m.channel_whatsapp },
  { id: 'telegram', label: m.channel_telegram },
] as const;

function Settings() {
  const hydrated = useHydrated();
  const settings = Route.useLoaderData();
  const router = useRouter();
  const readOnly = !settings.canEdit;
  const [state, setState] = useState<'idle' | 'pending' | 'saved' | 'error'>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '');
    setState('pending');
    try {
      await updateSettings({
        data: {
          companyName: text('companyName'),
          address: text('address'),
          phone: text('phone'),
          email: text('email'),
          rccm: text('rccm'),
          nif: text('nif'),
          locale: text('locale') === 'en' ? 'en' : 'fr',
          timeZone: text('timeZone'),
          currency: text('currency'),
          notificationChannels: form.getAll('channels').map(String) as (
            'email' | 'whatsapp' | 'telegram'
          )[],
        },
      });
      setState('saved');
      await router.invalidate();
    } catch {
      setState('error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-headline text-headline font-extrabold">{m.settings_title()}</h1>
        <p className="text-body-lg text-bark">{m.settings_intro()}</p>
      </div>
      {readOnly && <Notice tone="info">{m.settings_read_only()}</Notice>}
      <LogoPanel logoUrl={settings.logoUrl} canEdit={settings.canEdit} />
      <form method="post" onSubmit={submit} className="flex flex-col gap-6">
        <fieldset disabled={readOnly} className="flex flex-col gap-6">
          <Panel title={m.settings_identity()}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={m.settings_company_name()}
                name="companyName"
                defaultValue={settings.companyName}
                maxLength={120}
              />
              <TextField
                label={m.settings_email()}
                name="email"
                type="email"
                defaultValue={settings.email}
                maxLength={120}
              />
              <TextField
                label={m.settings_phone()}
                name="phone"
                type="tel"
                defaultValue={settings.phone}
                maxLength={40}
              />
              <TextField
                label={m.settings_address()}
                name="address"
                defaultValue={settings.address}
                maxLength={300}
              />
              <TextField
                label={m.settings_rccm()}
                name="rccm"
                defaultValue={settings.rccm}
                maxLength={60}
              />
              <TextField
                label={m.settings_nif()}
                name="nif"
                defaultValue={settings.nif}
                maxLength={60}
              />
            </div>
          </Panel>

          <Panel title={m.settings_preferences()}>
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField label={m.settings_locale()} name="locale" defaultValue={settings.locale}>
                <option value="fr">{m.locale_fr()}</option>
                <option value="en">{m.locale_en()}</option>
              </SelectField>
              <SelectField
                label={m.settings_time_zone()}
                name="timeZone"
                defaultValue={settings.timeZone}
              >
                {(timeZones.includes(settings.timeZone)
                  ? timeZones
                  : [settings.timeZone, ...timeZones]
                ).map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label={m.settings_currency()}
                name="currency"
                defaultValue={settings.currency}
              >
                {(currencies.includes(settings.currency)
                  ? currencies
                  : [settings.currency, ...currencies]
                ).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </SelectField>
            </div>
            <fieldset className="mt-6 flex flex-col gap-2">
              <legend className="mb-2 text-body-sm font-semibold">{m.settings_channels()}</legend>
              {channels.map((channel) => (
                <label key={channel.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="channels"
                    value={channel.id}
                    defaultChecked={settings.notificationChannels.includes(channel.id)}
                    className="size-5 accent-primary"
                  />
                  {channel.label()}
                </label>
              ))}
            </fieldset>
          </Panel>
        </fieldset>

        {state === 'saved' && <Notice tone="success">{m.settings_saved()}</Notice>}
        {state === 'error' && <Notice tone="error">{m.error_generic()}</Notice>}
        {!readOnly && (
          <div>
            <Button type="submit" disabled={state === 'pending' || !hydrated}>
              {state === 'pending' ? m.common_loading() : m.settings_save()}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
