import { createHash } from 'node:crypto';

// The Compte Kete's two layers, as an app reads them (spec 115, FR-006): the organization's
// generic settings and the person's preferences, with the person's token. Kept five minutes per
// token's hash — never the token itself. Without a Compte Kete or a token: nothing, the defaults
// apply. Nothing here throws at the app.

export interface AccountLayers {
  organization: Record<string, unknown>;
  person: Record<string, unknown>;
}

export interface AccountSettingsOptions {
  /** The Compte Kete, `https://compte.kete.software`; empty when the app works alone. */
  url: string | null | undefined;
  /** How long an answer is kept, in seconds (default 300, at most 300). */
  keepSeconds?: number;
  fetch?: typeof fetch;
  now?: () => number;
}

export interface AccountSettings {
  readonly connected: boolean;
  /** Both layers for the person whose token is given; empty layers without an answer. */
  read(token: string | null | undefined): Promise<AccountLayers>;
  /** Saves one of her preferences; it follows her in every app. */
  savePreference(
    token: string | null | undefined,
    key: string,
    value: unknown,
  ): Promise<{ ok: true } | { ok: false; error: string }>;
}

const EMPTY: AccountLayers = { organization: {}, person: {} };
const LIMIT = 2000;

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function createAccountSettings(options: AccountSettingsOptions): AccountSettings {
  const base = (options.url ?? '').trim().replace(/\/$/, '') || null;
  const call = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const keep = Math.min(Math.max(options.keepSeconds ?? 300, 0), 300) * 1000;
  const cache = new Map<string, { at: number; value: AccountLayers }>();
  const keyOf = (token: string) => createHash('sha256').update(token).digest('base64url');

  return {
    connected: base !== null,

    async read(token) {
      if (!base || !token) return EMPTY;
      const key = keyOf(token);
      const kept = cache.get(key);
      if (kept && now() - kept.at < keep) return kept.value;
      const response = await call(`${base}/api/apps/settings`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
      }).catch(() => null);
      if (!response?.ok) return EMPTY;
      const body = record(await response.json().catch(() => null));
      const value = { organization: record(body.organization), person: record(body.person) };
      if (cache.size >= LIMIT) cache.delete(cache.keys().next().value as string);
      cache.set(key, { at: now(), value });
      return value;
    },

    async savePreference(token, key, value) {
      if (!base) return { ok: false, error: 'not_connected' };
      if (!token) return { ok: false, error: 'signed_out' };
      const response = await call(`${base}/api/apps/settings`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ key, value }),
        signal: AbortSignal.timeout(4000),
      }).catch(() => null);
      if (!response) return { ok: false, error: 'unreachable' };
      // What she just chose is read again at her next page, not five minutes later.
      cache.delete(keyOf(token));
      if (response.ok) return { ok: true };
      const answer = record(await response.json().catch(() => null));
      return {
        ok: false,
        error: typeof answer.error === 'string' ? answer.error : `http_${response.status}`,
      };
    },
  };
}
