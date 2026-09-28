import { describe, expect, it } from 'vitest';
import {
  healthHandler,
  InvalidManifestError,
  manifestHandler,
  parseManifest,
  validateHealthReport,
} from '../src/index.js';
import { manifest } from './support/fixtures.js';

describe('manifest (US3, FR-015)', () => {
  it('serves a valid manifest and refuses an invalid one', async () => {
    const response = manifestHandler(parseManifest(manifest))();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(manifest);
    expect(() => parseManifest({ ...manifest, environment: 'prod' })).toThrow(InvalidManifestError);
  });
});

describe('health handler (US3, SC-006)', () => {
  it('answers 200 when healthy and 503 when every dependency is down', async () => {
    const up = healthHandler({
      version: '0.1.0',
      dependencies: [{ name: 'database', probe: () => Promise.resolve() }],
      backlog: () => Promise.resolve({ pending: 2, oldest_pending_age_seconds: 12 }),
    });
    const upResponse = await up();
    const report: unknown = await upResponse.json();
    expect(upResponse.status).toBe(200);
    expect(validateHealthReport(report).ok).toBe(true);

    const down = healthHandler({
      version: '0.1.0',
      dependencies: [{ name: 'database', probe: () => Promise.reject(new Error('down')) }],
      backlog: () => Promise.resolve({ pending: 0 }),
    });
    expect((await down()).status).toBe(503);
  });

  it('marks a dependency down when its probe hangs past the timeout', async () => {
    const handler = healthHandler({
      version: '0.1.0',
      timeoutMs: 50,
      dependencies: [
        { name: 'database', probe: () => Promise.resolve() },
        { name: 'storage', probe: () => new Promise(() => undefined) },
      ],
      backlog: () => Promise.resolve({ pending: 0 }),
    });
    const report = (await (await handler()).json()) as { status: string };
    expect(report.status).toBe('degraded');
  });
});
