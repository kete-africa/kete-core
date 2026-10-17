import { clearSetting, setSetting, SettingError } from '@kete/settings';
import type { SettingRow } from '@kete/shell';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { getLocale } from '@/paraglide/runtime.js';
import { transaction } from '@/platform/db';
import { holds } from '@/platform/rights';
import { signedIn } from '@/platform/screen';
import { tokenOf } from '@/platform/session';
import { accountSettings, settingRows, settingsOf, settingsRegistry } from '@/platform/settings';

// « Réglages » (kete-core spec 116): her preferences go to the Compte Kete, so they follow her in
// every app; the app's settings for the whole organization stay here, journaled, for whoever holds
// `settings:manage`.

type Result = { ok: true } | { ok: false; error: string };

/** A value as it travels to the page: plain JSON. */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type ScreenRow = Omit<SettingRow, 'schema' | 'value'> & {
  schema: { [key: string]: Json };
  value: Json;
};

/** The settings as they apply to her, each with where it comes from and whether she sets it here. */
export const fetchSettingsScreen = createServerFn({ method: 'GET' }).handler(async () => {
  const { as } = await signedIn();
  const request = getRequest();
  const [resolved, token] = await Promise.all([settingsOf(request), tokenOf(request)]);
  const manage = await as(() => holds('settings:manage'));
  const rows = settingRows(resolved, {
    lang: getLocale() === 'en' ? 'en' : 'fr',
    personal: accountSettings().connected && token !== null,
    manage,
  });
  // A setting's value is plain JSON: the page receives it as it is.
  return { rows: JSON.parse(JSON.stringify(rows)) as ScreenRow[] };
});

const change = z.object({
  key: z.string().min(3).max(120),
  layer: z.enum(['person', 'app']),
  value: z.unknown(),
});

/** The app's own layer, under `settings:manage`; a refusal comes back as its code. */
async function onAppLayer(
  work: (organizationId: string, by: string) => Promise<unknown>,
): Promise<Result> {
  const { identity, as } = await signedIn();
  if (!(await as(() => holds('settings:manage')))) return { ok: false, error: 'forbidden' };
  const organizationId = identity.organizationId ?? '';
  try {
    await work(organizationId, identity.userId);
    return { ok: true };
  } catch (error) {
    if (error instanceof SettingError) return { ok: false, error: error.code };
    throw error;
  }
}

/** Sets a value: hers in the Compte Kete, or the app's for the whole organization. */
export const saveSetting = createServerFn({ method: 'POST' })
  .validator((input: unknown) => change.parse(input))
  .handler(async ({ data }): Promise<Result> => {
    if (data.layer === 'person') {
      await signedIn();
      return accountSettings().savePreference(await tokenOf(getRequest()), data.key, data.value);
    }
    return onAppLayer((organizationId, by) =>
      transaction(organizationId, (db) =>
        setSetting(db, organizationId, settingsRegistry, {
          layer: 'app',
          key: data.key,
          value: data.value,
          by,
        }),
      ),
    );
  });

/** Takes a value back to what it inherits. */
export const clearSettingValue = createServerFn({ method: 'POST' })
  .validator((input: unknown) => change.omit({ value: true }).parse(input))
  .handler(async ({ data }): Promise<Result> => {
    if (data.layer === 'person') {
      await signedIn();
      return accountSettings().savePreference(await tokenOf(getRequest()), data.key, null);
    }
    return onAppLayer((organizationId, by) =>
      transaction(organizationId, (db) =>
        clearSetting(db, organizationId, { layer: 'app', key: data.key, by }),
      ),
    );
  });
