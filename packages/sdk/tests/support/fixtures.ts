import type { Manifest } from '../../src/contracts/types.gen.js';
import type { SigningKey } from '../../src/signing/signature.js';

export const manifest: Manifest = {
  product: 'prd_sample',
  name: 'Sample',
  version: '0.1.0',
  environment: 'development',
  events: ['account.created', 'payment.succeeded', 'metrics.daily', 'deposit.created'],
};

export const key: SigningKey = { kid: 'key_1', secret: 'a'.repeat(32) + 'secret-for-tests-only' };

export const keyRing = new Map([[manifest.product, [key]]]);

export const orgA = 'org_alpha_001';
export const orgB = 'org_bravo_002';
