import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// What an organization entrusts to a deployment (a sender's token, its webhook's secret): sealed
// at rest with AES-256-GCM under a key the deployment holds outside the database
// (`KETE_SECRETS_KEY`, 32 random bytes in base64). Never returned, never logged.

/** The deployment's key, or null when it has none: nothing is kept without it. */
export function secretsKey(
  value: string | undefined = process.env.KETE_SECRETS_KEY,
): Buffer | null {
  const bytes = Buffer.from(value ?? '', 'base64');
  return bytes.length === 32 ? bytes : null;
}

/** Seals a secret: `v1.<iv>.<tag>.<ciphertext>`, each in base64url. */
export function seal(key: Buffer, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const sealed = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [
    'v1',
    ...[iv, cipher.getAuthTag(), sealed].map((part) => part.toString('base64url')),
  ].join('.');
}

/** Opens a sealed secret; null when it was sealed under another key, or tampered with. */
export function open(key: Buffer, sealed: string): string | null {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !data) return null;
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
}
