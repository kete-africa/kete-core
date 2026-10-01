import { type FormEvent, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button, TextField } from '@kete/design';
import { authClient } from '@/lib/auth-client';
import { Notice, useHydrated } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/espace/nouvelle-organisation')({
  component: NewOrganization,
});

/** A readable, unique slug; organizations are found by identifier, never by slug. */
function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base || 'org'}-${crypto.randomUUID().slice(0, 8)}`;
}

function NewOrganization() {
  const hydrated = useHydrated();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name')).trim();
    if (!name) return;
    setPending(true);
    setError(false);
    const { data, error: failure } = await authClient.organization.create({
      name,
      slug: slugify(name),
    });
    if (failure || !data) {
      setError(true);
      setPending(false);
      return;
    }
    await authClient.organization.setActive({ organizationId: data.id });
    window.location.assign('/espace');
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-headline text-headline font-extrabold">{m.org_create_title()}</h1>
        <p className="text-body-lg text-bark">{m.org_create_intro()}</p>
      </div>
      <form method="post" onSubmit={submit} className="flex flex-col gap-4">
        {error && <Notice tone="error">{m.error_generic()}</Notice>}
        <TextField label={m.org_name()} name="name" maxLength={80} required />
        <Button type="submit" disabled={pending || !hydrated}>
          {pending ? m.common_loading() : m.org_create_submit()}
        </Button>
      </form>
    </div>
  );
}
