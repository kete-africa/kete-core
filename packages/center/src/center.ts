import { createHash } from 'node:crypto';

// The center (Kete Enterprise) as an app sees it (kete-core spec 049): every call carries the
// person's token, so the center answers within her rights — never more. When the center is not
// configured, or does not answer, the app goes on alone: nothing here throws at the app.

/** What a center answers about a person, for one app (same shape as `@kete/capabilities`). */
export interface CenterGrants {
  managed: boolean;
  permissions: { permission: string; everywhere: boolean; units: string[] }[];
}

export interface CenterTask {
  /** The app's own key: sending it again updates the task. */
  key: string;
  title: string;
  href: string;
  dueAt?: string;
}

export interface CenterReading {
  quarter: string;
  indicator: string;
  value: number;
  proof: string;
}

export interface CenterOptions {
  /** The center's API, `https://api.enterprise.example`; empty when the app works alone. */
  url: string | null | undefined;
  /** The app's product id, as its manifest declares it: `prd_kete_helpdesk`. */
  product: string;
  /** How the center names the app in a person's To do: `kete-helpdesk`. */
  source: string;
  /** How long a person's grants are kept, in seconds (default 300, at most 300). */
  grantsSeconds?: number;
  fetch?: typeof fetch;
  now?: () => number;
}

export interface Center {
  /** Whether a center is configured. */
  readonly connected: boolean;
  /** The person's grants for this app; null without a center, a token, or an answer. */
  grants(token: string | null | undefined): Promise<CenterGrants | null>;
  /** Puts a task in the person's To do; sending it again updates it. */
  sendTask(token: string | null | undefined, task: CenterTask): Promise<void>;
  /** Takes a task out of her To do, once done here. */
  closeTask(token: string | null | undefined, key: string): Promise<void>;
  /** Sends an indicator's reading for her quarter's review. */
  sendReading(
    token: string | null | undefined,
    reading: CenterReading,
  ): Promise<{ ok: boolean; error: string | null }>;
}

const CACHE_LIMIT = 2000;

export function createCenter(options: CenterOptions): Center {
  const base = (options.url ?? '').trim().replace(/\/$/, '') || null;
  const call = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const keep = Math.min(Math.max(options.grantsSeconds ?? 300, 0), 300) * 1000;
  const cache = new Map<string, { at: number; value: CenterGrants }>();

  const headers = (token: string) => ({
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'kete-channel': 'api',
  });

  async function post(token: string, path: string, body: object): Promise<Response | null> {
    if (!base) return null;
    return call(`${base}${path}`, {
      method: 'POST',
      headers: { ...headers(token), 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);
  }

  return {
    connected: base !== null,

    async grants(token) {
      if (!base || !token) return null;
      // Kept per token, never by the token itself: its hash.
      const key = createHash('sha256').update(token).digest('base64url');
      const kept = cache.get(key);
      if (kept && now() - kept.at < keep) return kept.value;
      const response = await call(`${base}/v1/apps/${encodeURIComponent(options.product)}/grants`, {
        headers: headers(token),
        signal: AbortSignal.timeout(4000),
      }).catch(() => null);
      if (!response?.ok) return null;
      const value = parseGrants(await response.json().catch(() => null));
      if (!value) return null;
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
      cache.set(key, { at: now(), value });
      return value;
    },

    async sendTask(token, task) {
      if (token) await post(token, '/v1/workspace/tasks', { ...task, source: options.source });
    },

    async closeTask(token, key) {
      if (token) await post(token, '/v1/workspace/tasks/close', { key, source: options.source });
    },

    async sendReading(token, reading) {
      if (!base) return { ok: false, error: 'not_connected' };
      if (!token) return { ok: false, error: 'signed_out' };
      const response = await post(token, '/v1/performance/readings', {
        ...reading,
        source: options.source,
      });
      if (!response) return { ok: false, error: 'unreachable' };
      if (response.ok) return { ok: true, error: null };
      const answer = (await response.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: answer.error ?? `http_${response.status}` };
    },
  };
}

/** A center's answer, checked: anything else counts as no answer. */
function parseGrants(value: unknown): CenterGrants | null {
  if (typeof value !== 'object' || value === null) return null;
  const { managed, permissions } = value as Record<string, unknown>;
  if (typeof managed !== 'boolean' || !Array.isArray(permissions)) return null;
  const list = permissions.flatMap((p) => {
    const g = p as Record<string, unknown>;
    return typeof g.permission === 'string' &&
      typeof g.everywhere === 'boolean' &&
      Array.isArray(g.units)
      ? [
          {
            permission: g.permission,
            everywhere: g.everywhere,
            units: g.units.filter((u): u is string => typeof u === 'string'),
          },
        ]
      : [];
  });
  return { managed, permissions: list };
}
