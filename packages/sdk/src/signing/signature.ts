import { createHmac, timingSafeEqual } from 'node:crypto';

export const SIGNATURE_HEADER = 'kete-signature';
export const PRODUCT_HEADER = 'kete-product';
/** Default freshness window, in seconds (research R-05). */
export const DEFAULT_TOLERANCE_SECONDS = 300;

export interface SigningKey {
  kid: string;
  /** At least 32 random bytes; never stored in a repository. */
  secret: string;
  /** Validity window, used during rotation. */
  notBefore?: Date;
  notAfter?: Date;
}

function hmac(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/** Returns the `Kete-Signature` header value for a raw request body. */
export function sign(body: string, key: SigningKey, now: Date = new Date()): string {
  const t = Math.floor(now.getTime() / 1000);
  return `t=${t},kid=${key.kid},v1=${hmac(key.secret, t, body)}`;
}

export type VerificationFailure = 'invalid_signature' | 'stale' | 'unknown_product';

/** The keys a receiver accepts, per product. */
export type KeyRing = ReadonlyMap<string, readonly SigningKey[]>;

function isValidAt(key: SigningKey, at: Date): boolean {
  return (!key.notBefore || key.notBefore <= at) && (!key.notAfter || at <= key.notAfter);
}

function parseSignature(header: string): Map<string, string> {
  const parts = new Map<string, string>();
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i > 0) parts.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  return parts;
}

/** Verifies a delivery's product, signature and freshness (FR-011, FR-014). */
export function verify(
  input: { product: string | null; signature: string | null; body: string },
  keyRing: KeyRing,
  options: { now?: Date; toleranceSeconds?: number } = {},
): { ok: true } | { ok: false; reason: VerificationFailure } {
  const now = options.now ?? new Date();
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const keys = input.product ? keyRing.get(input.product) : undefined;
  if (!keys || keys.length === 0) return { ok: false, reason: 'unknown_product' };

  const parts = parseSignature(input.signature ?? '');
  const t = Number(parts.get('t'));
  const kid = parts.get('kid');
  const v1 = parts.get('v1');
  if (!Number.isInteger(t) || !kid || !v1 || !/^[0-9a-f]{64}$/.test(v1)) {
    return { ok: false, reason: 'invalid_signature' };
  }
  const key = keys.find((k) => k.kid === kid && isValidAt(k, now));
  if (!key) return { ok: false, reason: 'invalid_signature' };

  const expected = Buffer.from(hmac(key.secret, t, input.body), 'hex');
  if (!timingSafeEqual(expected, Buffer.from(v1, 'hex'))) {
    return { ok: false, reason: 'invalid_signature' };
  }
  if (Math.abs(now.getTime() / 1000 - t) > tolerance) return { ok: false, reason: 'stale' };
  return { ok: true };
}
