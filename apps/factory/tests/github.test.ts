import { createRequire } from 'node:module';
import type Sodium from 'libsodium-wrappers';
import { describe, expect, it } from 'vitest';
import { sealForGitHub } from '../src/adapters/github.js';

// The GitHub adapter loads under Node as the factory runs, and seals a secret only the key's
// owner opens (the factory once failed at start on libsodium's ES module).

const sodium = createRequire(import.meta.url)('libsodium-wrappers') as typeof Sodium;

describe('a secret for a repository', () => {
  it('is sealed for its public key, and opened only with its private key', async () => {
    await sodium.ready;
    const pair = sodium.crypto_box_keypair();
    const publicKey = sodium.to_base64(pair.publicKey, sodium.base64_variants.ORIGINAL);
    const sealed = await sealForGitHub('ghp_packages', publicKey);
    const opened = sodium.crypto_box_seal_open(
      sodium.from_base64(sealed, sodium.base64_variants.ORIGINAL),
      pair.publicKey,
      pair.privateKey,
    );
    expect(sodium.to_string(opened)).toBe('ghp_packages');
  });
});
