import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// A connection's credential is sealed at rest with AES-256-GCM under the product's key (32 random
// bytes in base64, `KETE_SECRETS_KEY`): never returned by a reading, never logged, never handed to
// an agent (spec 119; Kete Enterprise spec 026 first did it).

export interface Sealer {
  /** Whether secrets can be kept: the key is set. */
  readonly on: boolean;
  /** `v1.<iv>.<tag>.<ciphertext>`, each in base64url. */
  seal(secret: string): string;
  /** The secret; null when sealed under another key, or tampered with. */
  open(sealed: string): string | null;
}

export class SealError extends Error {
  constructor() {
    super('No key to seal secrets: KETE_SECRETS_KEY is not 32 bytes in base64.');
    this.name = 'SealError';
  }
}

/** A sealer under a key of 32 bytes in base64; without one, nothing is kept. */
export function createSealer(keyBase64: string | null | undefined): Sealer {
  const bytes = Buffer.from(keyBase64 ?? '', 'base64');
  const key = bytes.length === 32 ? bytes : null;
  return {
    on: key !== null,
    seal(secret) {
      if (!key) throw new SealError();
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const sealed = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
      return ['v1', iv, cipher.getAuthTag(), sealed]
        .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
        .join('.');
    },
    open(sealed) {
      const [version, iv, tag, data] = sealed.split('.');
      if (!key || version !== 'v1' || !iv || !tag || !data) return null;
      try {
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
        decipher.setAuthTag(Buffer.from(tag, 'base64url'));
        return Buffer.concat([
          decipher.update(Buffer.from(data, 'base64url')),
          decipher.final(),
        ]).toString('utf8');
      } catch {
        return null;
      }
    },
  };
}
