import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// One connection, three uses (spec 147; doctrine D-062, R8; ADR 0019): an external tool connected
// once serves to read (figures, Kete's answers), to act (agents' tools, as drafts) and to signal
// (what waits, into « Décider »). Three grants, kept apart: read is given at connection; act only
// tool by tool, at a level, never committing alone; signal by choosing what to watch. Its events
// arrive by a webhook signed with a secret of its own.

/** The levels an act may be granted at: read-like (1), undoable (2), a draft (3) — never alone. */
export type ActLevel = 1 | 2 | 3;

export interface ConnectionGrants {
  read: boolean;
  /** Each tool it may act with, and at which level. None by default. */
  act: Record<string, ActLevel>;
  /** The tools it reads for what waits, each a signal. */
  signal: string[];
}

/** What a connection may do when it is made: read, nothing else (R8). */
export const defaultGrants = (): ConnectionGrants => ({ read: true, act: {}, signal: [] });

export type Use = 'read' | 'act' | 'signal';

/**
 * Whether a connection's grants allow a use of one of its tools — and for an act, the level it may
 * run at: never above what was granted, never above « prepare » (3).
 */
export function allows(
  grants: ConnectionGrants,
  use: Use,
  tool: string,
): { allowed: false } | { allowed: true; level: ActLevel | null } {
  if (use === 'read') return grants.read ? { allowed: true, level: null } : { allowed: false };
  if (use === 'signal') {
    return grants.signal.includes(tool) ? { allowed: true, level: null } : { allowed: false };
  }
  const level = grants.act[tool];
  return level ? { allowed: true, level: Math.min(level, 3) as ActLevel } : { allowed: false };
}

/** Reads grants as they were kept; what is not understood grants nothing. */
export function grantsOf(value: unknown): ConnectionGrants {
  const v = (value ?? {}) as Partial<Record<keyof ConnectionGrants, unknown>>;
  const act: Record<string, ActLevel> = {};
  if (v.act && typeof v.act === 'object') {
    for (const [tool, level] of Object.entries(v.act as Record<string, unknown>)) {
      if (level === 1 || level === 2 || level === 3) act[tool] = level;
    }
  }
  return {
    read: v.read === true,
    act,
    signal: Array.isArray(v.signal)
      ? v.signal.filter((t): t is string => typeof t === 'string').slice(0, 50)
      : [],
  };
}

/** A webhook's secret: 32 random bytes, sealed with the connection, shown once to who sets it. */
export function newWebhookSecret(): string {
  return randomBytes(32).toString('base64url');
}

/** The signature an external tool sends: `sha256=` and the HMAC of the exact body, in hex. */
export function signWebhook(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
}

/** Whether a webhook's signature is the connection's, compared in constant time. */
export function verifyWebhook(secret: string, body: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signWebhook(secret, body));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
