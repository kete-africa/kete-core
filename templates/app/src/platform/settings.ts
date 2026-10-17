import { themeFromCookies } from '@kete/design';
import {
  createAccountSettings,
  defineSettings,
  keteSettings,
  readLayers,
  resolve,
  type AccountLayers,
  type Resolved,
  type SettingDeclaration,
} from '@kete/settings';
import { transaction } from './db';
import { personOf, tokenOf } from './session';

// This app's settings (kete-core spec 115; decision 0013): Kete's own and the app's, declared once,
// resolved by layers — the Compte Kete's (the organization's, the person's), the app's and its
// units' kept here, the device's cookie — the most precise wins. No business setting is read from
// an environment variable.

/** The app's own settings: each feature declares its keys (`<product>.<name>`) here. */
const appSettings: SettingDeclaration[] = [];

export const settingsRegistry = defineSettings(keteSettings, appSettings);

let account: ReturnType<typeof createAccountSettings> | undefined;
/** The Compte Kete's two layers, read with the person's token. */
export function accountSettings() {
  account ??= createAccountSettings({ url: process.env.KETE_ACCOUNT_URL });
  return account;
}

/**
 * Every layer gathered: the Compte Kete's, this app's, the device's cookie. The cookie is only a
 * copy of her theme: it stands in when the Compte Kete holds none (or cannot be reached), never
 * against what she chose since in another app.
 */
export function settingsFrom(input: {
  account: AccountLayers;
  app?: Record<string, unknown>;
  entity?: Record<string, unknown>;
  cookie?: string | null;
}): Resolved {
  const theme = Object.hasOwn(input.account.person, 'kete.theme')
    ? null
    : themeFromCookies(input.cookie);
  return resolve(settingsRegistry, {
    organization: input.account.organization,
    person: input.account.person,
    ...(input.app ? { app: input.app } : {}),
    ...(input.entity ? { entity: input.entity } : {}),
    ...(theme ? { device: { 'kete.theme': theme } } : {}),
  });
}

/** The settings as they apply to the person behind a request. */
export async function settingsOf(request: Request): Promise<Resolved> {
  const [identity, token] = await Promise.all([personOf(request), tokenOf(request)]);
  const layers = await accountSettings().read(token);
  const kept = identity?.organizationId
    ? await transaction(identity.organizationId, (db) => readLayers(db)).catch(() => null)
    : null;
  return settingsFrom({
    account: layers,
    ...(kept ? { app: kept.app } : {}),
    cookie: request.headers.get('cookie'),
  });
}

/** Saves one of her preferences in the Compte Kete: it follows her in every app. */
export async function savePreferenceOf(request: Request, key: string, value: unknown) {
  return accountSettings().savePreference(await tokenOf(request), key, value);
}
