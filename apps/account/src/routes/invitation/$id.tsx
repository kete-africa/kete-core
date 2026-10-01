import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@kete/design';
import { fetchInvitation, fetchViewer } from '@/features/identity/functions';
import { authClient } from '@/lib/auth-client';
import { AuthFrame, Notice, useHydrated } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/invitation/$id')({
  loader: async ({ params }) => ({
    invitation: await fetchInvitation({ data: { id: params.id } }),
    viewer: await fetchViewer(),
  }),
  component: Invitation,
});

function Invitation() {
  const hydrated = useHydrated();
  const { id } = Route.useParams();
  const { invitation, viewer } = Route.useLoaderData();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  if (!invitation) {
    return (
      <AuthFrame title={m.invitation_title()}>
        <Notice tone="error">{m.invitation_invalid()}</Notice>
      </AuthFrame>
    );
  }

  async function accept() {
    setPending(true);
    setError(false);
    const { data, error: failure } = await authClient.organization.acceptInvitation({
      invitationId: id,
    });
    if (failure || !data) {
      setError(true);
      setPending(false);
      return;
    }
    await authClient.organization.setActive({ organizationId: data.member.organizationId });
    window.location.assign('/espace');
  }

  const here = `/invitation/${id}`;
  return (
    <AuthFrame
      title={m.invitation_title()}
      intro={m.invitation_text({ organization: invitation.organizationName })}
    >
      <p className="text-body-sm text-bark">{m.invitation_for({ email: invitation.email })}</p>
      {error && <Notice tone="error">{m.invitation_wrong_account()}</Notice>}
      {viewer ? (
        <Button onClick={() => void accept()} disabled={pending || !hydrated}>
          {pending ? m.common_loading() : m.invitation_accept()}
        </Button>
      ) : (
        <>
          <p className="text-body">{m.invitation_sign_in_first()}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/inscription"
              search={{ redirect: here }}
              className="inline-flex h-12 items-center rounded-control bg-primary px-6 font-semibold text-sand hover:bg-primary-strong"
            >
              {m.auth_create_account()}
            </Link>
            <Link
              to="/connexion"
              search={{ redirect: here }}
              className="inline-flex h-12 items-center rounded-control border border-ink bg-paper px-6 font-semibold hover:bg-clay"
            >
              {m.auth_sign_in_submit()}
            </Link>
          </div>
        </>
      )}
    </AuthFrame>
  );
}
