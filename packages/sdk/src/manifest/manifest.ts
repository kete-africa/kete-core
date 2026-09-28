import { readFileSync } from 'node:fs';
import type { Manifest } from '../contracts/types.gen.js';
import { validateManifest } from '../contracts/validate.js';

export class InvalidManifestError extends Error {
  constructor(readonly details: string[]) {
    super(`Invalid kete.json: ${details.join('; ')}`);
    this.name = 'InvalidManifestError';
  }
}

/** Validates a manifest object against the manifest contract. */
export function parseManifest(value: unknown): Manifest {
  const result = validateManifest(value);
  if (!result.ok) throw new InvalidManifestError(result.errors);
  return value as Manifest;
}

/** Loads and validates `kete.json`. */
export function loadManifest(path: string): Manifest {
  return parseManifest(JSON.parse(readFileSync(path, 'utf8')));
}

/** `GET /.well-known/kete`. */
export function manifestHandler(manifest: Manifest): () => Response {
  return () => Response.json(manifest, { headers: { 'cache-control': 'max-age=60' } });
}
