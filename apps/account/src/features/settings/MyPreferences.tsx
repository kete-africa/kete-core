import { Panel } from '@kete/design';
import { useState } from 'react';
import { Notice, SelectField } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';
import { updateMyPreference } from './functions';

// « Mes préférences » (spec 115): her layer of Kete's settings, saved one choice at a time, the same
// in every Kete app. Empty means she inherits the organization's. The Compte Kete draws in its own
// mode: her theme is saved here and applied by the apps.

const zones = [
  'Africa/Lome',
  'Africa/Abidjan',
  'Africa/Accra',
  'Africa/Dakar',
  'Africa/Douala',
  'Africa/Lagos',
  'Africa/Porto-Novo',
  'Europe/Paris',
  'UTC',
];
const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

type Preferences = Record<string, unknown>;

export function MyPreferences({ preferences }: { preferences: Preferences }) {
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle');
  const quiet = (preferences['kete.quiet_hours'] ?? null) as { from: string; to: string } | null;
  const [quietFrom, setQuietFrom] = useState(quiet?.from ?? '');
  const [quietTo, setQuietTo] = useState(quiet?.to ?? '');

  async function save(key: string, value: unknown) {
    try {
      await updateMyPreference({ data: { key, value } });
      setState('saved');
    } catch {
      setState('error');
    }
  }
  const text = (key: string) =>
    typeof preferences[key] === 'string' ? String(preferences[key]) : '';

  return (
    <Panel title={m.prefs_title()}>
      <p className="mb-4 text-body-sm text-bark">{m.prefs_intro()}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label={m.prefs_theme()}
          defaultValue={text('kete.theme') || 'auto'}
          onChange={(event) => void save('kete.theme', event.currentTarget.value)}
        >
          <option value="auto">{m.prefs_theme_auto()}</option>
          <option value="light">{m.prefs_theme_light()}</option>
          <option value="dark">{m.prefs_theme_dark()}</option>
        </SelectField>
        <SelectField
          label={m.prefs_locale()}
          defaultValue={text('kete.locale')}
          onChange={(event) => void save('kete.locale', event.currentTarget.value || null)}
        >
          <option value="">{m.prefs_locale_inherit()}</option>
          <option value="fr">{m.locale_fr()}</option>
          <option value="en">{m.locale_en()}</option>
        </SelectField>
        <SelectField
          label={m.settings_time_zone()}
          defaultValue={text('kete.time_zone')}
          onChange={(event) => void save('kete.time_zone', event.currentTarget.value || null)}
        >
          <option value="">{m.prefs_time_zone_inherit()}</option>
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={m.prefs_text_size()}
          defaultValue={text('kete.text_size') || 'normal'}
          onChange={(event) => void save('kete.text_size', event.currentTarget.value)}
        >
          <option value="normal">{m.prefs_text_normal()}</option>
          <option value="large">{m.prefs_text_large()}</option>
        </SelectField>
      </div>
      <fieldset className="mt-6 flex flex-col gap-2">
        <legend className="mb-1 text-body-sm font-semibold">{m.prefs_quiet()}</legend>
        <p className="text-body-sm text-bark">{m.prefs_quiet_hint()}</p>
        <div className="grid max-w-md grid-cols-2 gap-4">
          <SelectField
            label={m.prefs_quiet_from()}
            value={quietFrom}
            onChange={(event) => {
              const from = event.currentTarget.value;
              setQuietFrom(from);
              const to = quietTo || (from ? '07:00' : '');
              setQuietTo(to);
              void save('kete.quiet_hours', from ? { from, to } : null);
            }}
          >
            <option value="">{m.prefs_quiet_none()}</option>
            {hours.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={m.prefs_quiet_to()}
            value={quietTo}
            disabled={!quietFrom}
            onChange={(event) => {
              const to = event.currentTarget.value;
              setQuietTo(to);
              void save('kete.quiet_hours', quietFrom && to ? { from: quietFrom, to } : null);
            }}
          >
            <option value="">{m.prefs_quiet_none()}</option>
            {hours.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </SelectField>
        </div>
      </fieldset>
      <label className="mt-6 flex items-center gap-3">
        <input
          type="checkbox"
          defaultChecked={preferences['kete.reduce_motion'] === true}
          onChange={(event) => void save('kete.reduce_motion', event.currentTarget.checked)}
          className="size-5 accent-primary"
        />
        {m.prefs_motion()}
      </label>
      {state === 'saved' && (
        <div className="mt-4">
          <Notice tone="success">{m.prefs_saved()}</Notice>
        </div>
      )}
      {state === 'error' && (
        <div className="mt-4">
          <Notice tone="error">{m.error_generic()}</Notice>
        </div>
      )}
    </Panel>
  );
}
