import { SettingsPanel, type SettingLayer, type SettingsWords } from '@kete/shell';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { clearSettingValue, fetchSettingsScreen, saveSetting } from '@/lib/settings';
import { AppShell } from '@/lib/shell';
import { requirePerson } from '@/lib/signed-in';
import * as m from '@/paraglide/messages.js';

// « Réglages » (kete-core spec 116; decision 0013): the same panel as in every Kete app — her
// preferences, which follow her everywhere, then the app's settings for the whole organization.
export const Route = createFileRoute('/reglages')({
  beforeLoad: ({ location }) => requirePerson(location.href),
  loader: () => fetchSettingsScreen(),
  component: SettingsPage,
});

const groups: Record<string, () => string> = {
  identity: m.settings_group_identity,
  language: m.settings_group_language,
  notifications: m.settings_group_notifications,
  calendar: m.settings_group_calendar,
  display: m.settings_group_display,
  agents: m.settings_group_agents,
  work: m.settings_group_work,
};
const layers: Record<SettingLayer, () => string> = {
  kete: m.settings_from_kete,
  organization: m.settings_from_organization,
  app: m.settings_from_app,
  entity: m.settings_from_entity,
  person: m.settings_from_person,
  device: m.settings_from_device,
};
const parts: Record<string, () => string> = { from: m.settings_part_from, to: m.settings_part_to };
const refusals: Record<string, () => string> = {
  invalid_value: m.settings_refused_value,
  forbidden: m.settings_refused_forbidden,
  not_connected: m.settings_refused_alone,
  unreachable: m.settings_refused_unreachable,
};

const words = (): SettingsWords => ({
  mine: m.settings_mine(),
  mineHint: m.settings_mine_hint(),
  organization: m.settings_organization(),
  organizationHint: m.settings_organization_hint(),
  group: (group) => groups[group]?.() ?? group,
  from: (layer) => layers[layer](),
  inherit: m.settings_inherit(),
  none: m.settings_none(),
  yes: m.settings_yes(),
  no: m.settings_no(),
  part: (name) => parts[name]?.() ?? name,
  elsewhere: (row) =>
    row.layers?.includes('app') ? m.settings_by_admin() : m.settings_in_account(),
  saving: m.settings_saving(),
  saved: m.settings_saved(),
  failed: (code) => (refusals[code] ?? m.settings_refused)(),
});

function SettingsPage() {
  const { rows } = Route.useLoaderData();
  const router = useRouter();
  return (
    <AppShell>
      <div className="flex max-w-[720px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-headline font-semibold">{m.settings_title()}</h1>
          <p className="text-body text-fg-muted">{m.settings_intro()}</p>
        </div>
        <SettingsPanel
          rows={rows}
          words={words()}
          onSave={async (key, layer, value) => {
            const result = await saveSetting({
              data: { key, layer: layer === 'person' ? 'person' : 'app', value },
            });
            if (result.ok) await router.invalidate();
            return result;
          }}
          onClear={async (key, layer) => {
            const result = await clearSettingValue({
              data: { key, layer: layer === 'person' ? 'person' : 'app' },
            });
            if (result.ok) await router.invalidate();
            return result;
          }}
        />
      </div>
    </AppShell>
  );
}
