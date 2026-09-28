import { useEffect } from 'react';
import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router';
import { KeteBand } from '@kete/design';
import { fetchViewer } from '@/features/identity/functions';
import { authClient } from '@/lib/auth-client';
import { LanguageSwitch, Wordmark } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';

const newOrganizationPath = '/espace/nouvelle-organisation';

export const Route = createFileRoute('/espace')({
  beforeLoad: async ({ location }) => {
    const viewer = await fetchViewer();
    if (!viewer) throw redirect({ to: '/connexion', search: { redirect: location.href } });
    if (viewer.organizations.length === 0 && location.pathname !== newOrganizationPath) {
      throw redirect({ to: newOrganizationPath });
    }
    return { viewer };
  },
  component: Space,
});

async function switchOrganization(organizationId: string) {
  await authClient.organization.setActive({ organizationId });
  window.location.reload();
}

function Space() {
  const { viewer } = Route.useRouteContext();
  const { actor, organizations } = viewer;
  const hasActive = actor.organizationId !== null;

  // A session that points at no organization (e.g. left it) opens on the first one.
  const fallback = !hasActive ? organizations[0]?.id : undefined;
  useEffect(() => {
    if (fallback) void switchOrganization(fallback);
  }, [fallback]);

  const links = [
    { to: '/espace', label: m.nav_tools(), exact: true },
    { to: '/espace/organisation', label: m.nav_organization(), exact: false },
    { to: '/espace/parametres', label: m.nav_settings(), exact: false },
  ] as const;

  return (
    <div className="flex min-h-dvh flex-col">
      <KeteBand />
      <header className="border-b border-rule bg-paper">
        {/* Phone: mark and account actions, then the organization, then the sections.
            Wider: mark, sections, organization, account actions — on one line. */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:gap-x-6 sm:px-8">
          <Link to="/espace" aria-label={m.nav_tools()} className="order-1">
            <Wordmark />
          </Link>
          <div className="order-2 ml-auto flex items-center gap-2 sm:order-5 sm:ml-0 sm:gap-3">
            <LanguageSwitch />
            <button
              type="button"
              onClick={async () => {
                await authClient.signOut();
                window.location.assign('/connexion');
              }}
              className="whitespace-nowrap text-body-sm font-semibold text-bark underline hover:text-ink"
            >
              {m.nav_sign_out()}
            </button>
          </div>
          {organizations.length > 0 && (
            <label className="order-3 w-full text-body-sm sm:order-4 sm:ml-auto sm:w-auto">
              <span className="sr-only">{m.nav_active_organization()}</span>
              <select
                value={actor.organizationId ?? ''}
                onChange={(event) => void switchOrganization(event.target.value)}
                className="h-9 w-full rounded-control border border-rule-strong bg-paper px-2 text-body-sm sm:max-w-52"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {hasActive && (
            <nav className="order-4 flex w-full gap-4 overflow-x-auto sm:order-2 sm:w-auto">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  activeOptions={{ exact: link.exact }}
                  className="whitespace-nowrap border-b-2 border-transparent py-1 text-body-sm font-semibold text-bark hover:text-ink data-[status=active]:border-primary data-[status=active]:text-ink"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8">
        {hasActive || organizations.length === 0 ? <Outlet /> : <p>{m.common_loading()}</p>}
      </main>
    </div>
  );
}
