import { type FormEvent, useState } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Button, Panel, Tag, TextField } from '@kete/design';
import { fetchMembers } from '@/features/identity/functions';
import { authClient } from '@/lib/auth-client';
import { Notice, SelectField, roleLabel, useHydrated } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/espace/organisation')({
  loader: () => fetchMembers(),
  component: Organization,
});

type InvitableRole = 'member' | 'admin';

function Organization() {
  const hydrated = useHydrated();
  const { members, invitations } = Route.useLoaderData();
  const { viewer } = Route.useRouteContext();
  const router = useRouter();
  const role = viewer.actor.role;
  const canAdminister = role === 'owner' || role === 'admin';
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError(false);
    setLink(null);
    const { data, error: failure } = await authClient.organization.inviteMember({
      email: String(form.get('email')).trim(),
      role: String(form.get('role')) as InvitableRole,
    });
    setPending(false);
    if (failure || !data) {
      setError(true);
      return;
    }
    setLink(`${window.location.origin}/invitation/${data.id}`);
    formElement.reset();
    await router.invalidate();
  }

  async function changeRole(memberId: string, next: InvitableRole) {
    setError(false);
    const { error: failure } = await authClient.organization.updateMemberRole({
      memberId,
      role: next,
    });
    if (failure) setError(true);
    await router.invalidate();
  }

  async function cancel(invitationId: string) {
    setError(false);
    const { error: failure } = await authClient.organization.cancelInvitation({ invitationId });
    if (failure) setError(true);
    await router.invalidate();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-headline text-headline font-extrabold">{m.nav_organization()}</h1>
      {error && <Notice tone="error">{m.error_forbidden()}</Notice>}

      <Panel title={m.members_title()}>
        <ul className="divide-y divide-rule">
          {members.map((row) => {
            const isSelf = row.userId === viewer.actor.userId;
            const editable = canAdminister && !isSelf && row.role !== 'owner';
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {row.name}
                    {isSelf && <span className="font-normal text-bark"> ({m.members_you()})</span>}
                  </p>
                  <p className="truncate text-body-sm text-bark">{row.email}</p>
                </div>
                {editable ? (
                  <select
                    aria-label={`${m.members_invite_role()} — ${row.name}`}
                    value={row.role}
                    onChange={(event) =>
                      void changeRole(row.id, event.target.value as InvitableRole)
                    }
                    className="h-9 rounded-control border border-rule-strong bg-paper px-2 text-body-sm"
                  >
                    <option value="member">{roleLabel('member')}</option>
                    <option value="admin">{roleLabel('admin')}</option>
                  </select>
                ) : (
                  <Tag tone={row.role === 'owner' ? 'agent' : 'neutral'}>{roleLabel(row.role)}</Tag>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      {invitations.length > 0 && (
        <Panel title={m.members_pending()}>
          <ul className="divide-y divide-rule">
            {invitations.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                <p className="min-w-0 flex-1 truncate">{row.email}</p>
                <Tag tone="verify">{roleLabel(row.role)}</Tag>
                {canAdminister && (
                  <button
                    type="button"
                    onClick={() => void cancel(row.id)}
                    className="text-body-sm font-semibold text-bark underline hover:text-ink"
                  >
                    {m.members_cancel_invitation()}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={m.members_invite_title()}>
        {canAdminister ? (
          <form method="post" onSubmit={invite} className="flex flex-col gap-4 sm:max-w-md">
            <TextField label={m.members_invite_email()} name="email" type="email" required />
            <SelectField label={m.members_invite_role()} name="role" defaultValue="member">
              <option value="member">{roleLabel('member')}</option>
              <option value="admin">{roleLabel('admin')}</option>
            </SelectField>
            <Button type="submit" disabled={pending || !hydrated}>
              {pending ? m.common_loading() : m.members_invite_submit()}
            </Button>
            {link && (
              <Notice tone="success">
                {m.members_invite_link()}{' '}
                <span className="break-all font-number" data-testid="invitation-link">
                  {link}
                </span>
              </Notice>
            )}
          </form>
        ) : (
          <p className="text-body-sm text-bark">{m.members_only_admins()}</p>
        )}
      </Panel>
    </div>
  );
}
