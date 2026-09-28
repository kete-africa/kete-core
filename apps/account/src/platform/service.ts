import { parseManifest, type HealthOptions, type Manifest } from '@kete/sdk';
import { sql } from 'drizzle-orm';
import { db } from './db';

const version = '0.1.0';

function environment(): Manifest['environment'] {
  const value = process.env.KETE_ENVIRONMENT;
  return value === 'production' || value === 'staging' || value === 'preview'
    ? value
    : 'development';
}

/** The Compte Kete's self-description (FR-008). It emits no event yet. */
export function manifest(): Manifest {
  return parseManifest({
    product: 'prd_kete_account',
    name: 'Compte Kete',
    version,
    environment: environment(),
    events: [],
  });
}

export const health: HealthOptions = {
  version,
  dependencies: [{ name: 'database', probe: () => db.execute(sql`select 1`) }],
  // No outbox in this service yet.
  backlog: () => Promise.resolve({ pending: 0 }),
};
