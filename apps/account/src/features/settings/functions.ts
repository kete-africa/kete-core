import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { actorFromHeaders } from '@/platform/actor';
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
