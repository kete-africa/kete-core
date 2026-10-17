import { createTokenVerifier, InvalidTokenError, type KeteIdentity } from '@kete/auth';
import { KETE_APPS_AUDIENCE } from '@kete/identity';
import { defineSettings, keteSettings, SettingError } from '@kete/settings';
import { eq, sql } from 'drizzle-orm';
import type { JSONWebKeySet } from 'jose';
import { inOrganization } from '@/platform/actor';
import { auth } from '@/platform/auth';
import { db } from '@/platform/db';
import { env } from '@/platform/env';
import { organizationSettings, userPreferences } from '@/platform/schema';

// The Compte Kete's two layers of Kete's settings (spec 115, FR-005; decision 0013): the
// organization's generic settings (D-013), said as `kete.*` keys, and the person's preferences,
// global like her identity. Apps read both with her token and save her preferences here, so they
// follow her in every app.

export const registry = defineSettings(keteSettings);

export class SettingsApiError extends Error {
  constructor(
    readonly status: 401 | 403 | 422,
    readonly code: string,
  ) {
    super(code);
    this.name = 'SettingsApiError';
  }
}

/** The person behind a token this Compte Kete issued for the apps; never an app alone. */
export async function personOfToken(request: Request): Promise<KeteIdentity> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) throw new SettingsApiError(401, 'unauthenticated');
  const jwks = await (auth.api as unknown as { getJwks(): Promise<JSONWebKeySet> }).getJwks();
  try {
    const identity = await createTokenVerifier({
      issuer: env.publicUrl,
      audience: KETE_APPS_AUDIENCE,
      jwks,
    })(token);
    if (!identity.organizationId) throw new SettingsApiError(403, 'no_organization');
    return identity;
  } catch (error) {
    if (error instanceof SettingsApiError) throw error;
    if (error instanceof InvalidTokenError) throw new SettingsApiError(401, 'invalid_token');
    throw error;
  }
}

/** The organization's layer: its generic settings, as `kete.*` keys; only what was entered. */
export async function organizationLayer(organizationId: string): Promise<Record<string, unknown>> {
  const [row] = await inOrganization(organizationId, (tx) =>
    tx.select().from(organizationSettings),
  );
  if (!row) return {};
  const layer: Record<string, unknown> = {
    'kete.locale': row.locale,
    'kete.time_zone': row.timeZone,
    'kete.currency': row.currency,
    'kete.notification_channels': row.notificationChannels,
    'kete.legal_ids': row.legalIds,
  };
  if (row.companyName) layer['kete.company_name'] = row.companyName;
  if (row.address) layer['kete.address'] = row.address;
  if (row.phone) layer['kete.phone'] = row.phone;
  if (row.email) layer['kete.email'] = row.email;
  return layer;
}

/** The person's layer: her preferences, the same in every organization. */
export async function personLayer(userId: string): Promise<Record<string, unknown>> {
  const [row] = await db
    .select({ values: userPreferences.values })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  return row?.values ?? {};
}

/**
 * Saves one of her preferences, checked against Kete's declaration and the person's layer; `null`
 * takes it back to what she inherits. Only she saves hers — never an agent acting for her.
 */
export async function savePreference(
  identity: KeteIdentity,
  input: { key?: unknown; value?: unknown },
): Promise<Record<string, unknown>> {
  if (identity.actingAgent) throw new SettingsApiError(403, 'not_yours');
  return savePersonPreference(identity.userId, input);
}

/** Saves one preference of a person, checked; `null` takes it back. */
export async function savePersonPreference(
  userId: string,
  input: { key?: unknown; value?: unknown },
): Promise<Record<string, unknown>> {
  const key = typeof input.key === 'string' ? input.key : '';
  let checked: unknown = null;
  if (input.value !== null) {
    try {
      checked = registry.check(key, 'person', input.value);
    } catch (error) {
      if (error instanceof SettingError) throw new SettingsApiError(422, error.code);
      throw error;
    }
  } else if (!registry.get(key)) {
    throw new SettingsApiError(422, 'unknown_setting');
  }
  const current = await personLayer(userId);
  const next = Object.fromEntries(Object.entries(current).filter(([name]) => name !== key));
  if (checked !== null) next[key] = checked;
  await db
    .insert(userPreferences)
    .values({ userId, values: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { values: next, updatedAt: sql`now()` },
    });
  return next;
}
