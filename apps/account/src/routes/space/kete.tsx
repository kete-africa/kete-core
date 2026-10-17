import { useState } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Button, Panel, Tag } from '@kete/design';
import { deployMyKete, fetchMyKete } from '@/features/deployments/functions';
import { Notice, SelectField } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

// « Mon Kete » (spec 123; phase 11, step B3): the organization deploys its Kete Enterprise
// itself — shared and ready at once, or dedicated, at its own place, or on its own, made by Kete.
export const Route = createFileRoute('/espace/kete')({
  loader: () => fetchMyKete(),
  component: MyKete,
});

type Mode = 'shared' | 'dedicated' | 'on_premises' | 'autonomous';
const MODES: Mode[] = ['shared', 'dedicated', 'on_premises', 'autonomous'];

const modeName: Record<Mode, () => string> = {
  shared: m.kete_mode_shared,
  dedicated: m.kete_mode_dedicated,
  on_premises: m.kete_mode_on_premises,
  autonomous: m.kete_mode_autonomous,
};
const modeHint: Record<Mode, () => string> = {
  shared: m.kete_mode_shared_hint,
  dedicated: m.kete_mode_dedicated_hint,
  on_premises: m.kete_mode_on_premises_hint,
  autonomous: m.kete_mode_autonomous_hint,
};
const appName: Record<string, () => string> = {
  prd_kete_finance: m.kete_app_finance,
  prd_kete_team: m.kete_app_team,
  prd_kete_commitments: m.kete_app_commitments,
  prd_kete_helpdesk: m.kete_app_helpdesk,
};
const refusal: Record<string, () => string> = {
  shared_unavailable: m.kete_refused_shared,
  already_requested: m.kete_refused_requested,
  same_mode: m.kete_refused_same,
  unknown_region: m.kete_refused_region,
  forbidden: m.kete_refused_forbidden,
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long' }).format(new Date(iso));
}

function MyKete() {
  const kete = Route.useLoaderData();
  const { deployment } = kete;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-headline text-headline font-extrabold">{m.kete_title()}</h1>
        <p className="text-body-lg text-bark">{m.kete_intro()}</p>
      </div>
      {deployment && (
        <Panel title={m.kete_current()}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">{modeName[deployment.mode]()}</span>
              {deployment.status === 'ready' ? (
                <Tag tone="validated">{m.kete_ready()}</Tag>
              ) : (
                <Tag tone="verify">{m.kete_requested()}</Tag>
              )}
            </div>
            <p className="text-body-sm text-bark">
              {m.kete_since({ date: formatDate(deployment.createdAt) })}
              {deployment.apps.length > 0 &&
                ` · ${deployment.apps.map((app) => appName[app]?.() ?? app).join(', ')}`}
            </p>
            {deployment.status === 'requested' && (
              <p className="text-body-sm">{m.kete_requested_hint()}</p>
            )}
            {deployment.url && (
              <a
                href={deployment.url}
                className="inline-flex h-10 w-fit items-center rounded-control border border-ink px-4 text-body-sm font-semibold hover:bg-clay"
              >
                {m.kete_open()}
              </a>
            )}
            {deployment.requestedMode && (
              <Notice tone="info">
                {m.kete_change_requested({ mode: modeName[deployment.requestedMode]() })}
              </Notice>
            )}
          </div>
        </Panel>
      )}
      {!kete.canDeploy
        ? !deployment && <Notice tone="info">{m.kete_only_admins()}</Notice>
        : (!deployment || (deployment.status === 'ready' && !deployment.requestedMode)) && (
            <DeployForm
              // A new state of the deployment, a fresh form: its choices are no longer the same.
              key={deployment ? `${deployment.mode}-${deployment.status}` : 'none'}
              first={!deployment}
              current={deployment?.mode ?? null}
              sharedAvailable={kete.sharedAvailable}
              regions={kete.regions}
              apps={kete.apps}
            />
          )}
    </div>
  );
}

function DeployForm({
  first,
  current,
  sharedAvailable,
  regions,
  apps,
}: {
  first: boolean;
  current: Mode | null;
  sharedAvailable: boolean;
  regions: { id: string; label: string }[];
  apps: string[];
}) {
  const router = useRouter();
  const choices = MODES.filter(
    (mode) => mode !== current && (mode !== 'shared' || sharedAvailable),
  );
  const [mode, setMode] = useState<Mode | null>(choices[0] ?? null);
  const [region, setRegion] = useState(regions[0]?.id ?? '');
  const [chosen, setChosen] = useState<string[]>([]);
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });

  async function submit() {
    if (!mode) return;
    setState({ busy: true, error: null });
    const answer = await deployMyKete({ data: { mode, region, apps: chosen } });
    if (answer.ok) {
      await router.invalidate();
      setState({ busy: false, error: null });
    } else {
      setState({ busy: false, error: answer.error });
    }
  }

  return (
    <Panel title={first ? m.kete_deploy_title() : m.kete_change_title()}>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-body-sm font-semibold">{m.kete_mode()}</legend>
        {choices.map((choice) => (
          <label
            key={choice}
            className={`flex cursor-pointer items-start gap-3 rounded-control border p-4 ${
              mode === choice ? 'border-ink bg-clay' : 'border-rule'
            }`}
          >
            <input
              type="radio"
              name="mode"
              className="mt-1 size-5 accent-primary"
              checked={mode === choice}
              onChange={() => setMode(choice)}
            />
            <span className="flex flex-col gap-1">
              <span className="font-semibold">
                {modeName[choice]()}
                {choice === 'shared' && (
                  <span className="ml-2 align-middle">
                    <Tag tone="validated">{m.kete_at_once()}</Tag>
                  </span>
                )}
              </span>
              <span className="text-body-sm text-bark">{modeHint[choice]()}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <SelectField
          label={m.kete_region()}
          value={region}
          onChange={(event) => setRegion(event.currentTarget.value)}
        >
          {regions.map((one) => (
            <option key={one.id} value={one.id}>
              {one.label}
            </option>
          ))}
        </SelectField>
      </div>
      {first && (
        <fieldset className="mt-6 flex flex-col gap-2">
          <legend className="mb-1 text-body-sm font-semibold">{m.kete_apps()}</legend>
          <p className="text-body-sm text-bark">{m.kete_apps_hint()}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {apps.map((app) => (
              <label key={app} className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={chosen.includes(app)}
                  onChange={(event) => {
                    const on = event.currentTarget.checked;
                    setChosen((now) => (on ? [...now, app] : now.filter((a) => a !== app)));
                  }}
                />
                {appName[app]?.() ?? app}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {state.error && (
        <div className="mt-4">
          <Notice tone="error">{(refusal[state.error] ?? m.error_generic)()}</Notice>
        </div>
      )}
      <div className="mt-6">
        <Button disabled={!mode || state.busy} onClick={() => void submit()}>
          {mode === 'shared' ? m.kete_deploy_now() : m.kete_ask()}
        </Button>
      </div>
    </Panel>
  );
}
