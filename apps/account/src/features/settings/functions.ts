import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { actorFromHeaders } from '@/platform/actor';
import { z } from 'zod';
import { personLayer, savePersonPreference } from './layers';
import { readSettings, saveSettings, settingsInput } from './settings';

export const fetchSettings = createServerFn({ method: 'GET' }).handler(async () =>
  readSettings(await actorFromHeaders(getRequestHeaders())),
);

export const updateSettings = createServerFn({ method: 'POST' })
  .validator((input: unknown) => settingsInput.parse(input))
  .handler(async ({ data }) => {
    await saveSettings(await actorFromHeaders(getRequestHeaders()), data);
    return { ok: true as const };
  });

/** A preference as it travels to the page: plain JSON. */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Her preferences (spec 115): her layer of Kete's settings, the same in every Kete app. */
export const fetchMyPreferences = createServerFn({ method: 'GET' }).handler(async () => {
  const actor = await actorFromHeaders(getRequestHeaders());
  if (!actor) throw new Error('signed_out');
  return (await personLayer(actor.userId)) as Record<string, Json>;
});

export const updateMyPreference = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z.object({ key: z.string().min(3).max(120), value: z.unknown() }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await actorFromHeaders(getRequestHeaders());
    if (!actor) throw new Error('signed_out');
    return (await savePersonPreference(actor.userId, data)) as Record<string, Json>;
  });
