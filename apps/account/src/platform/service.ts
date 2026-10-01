import { outboxBacklog, parseManifest, type HealthOptions, type Manifest } from '@kete/sdk';
import { sql } from 'drizzle-orm';
import { db, getPool } from './db';
import { DECLARED_EVENTS, PRODUCT } from './events';

const version = '0.2.0';

function environment(): Manifest['environment'] {
  const value = process.env.KETE_ENVIRONMENT;
  return value === 'production' || value === 'staging' || value === 'preview'
    ? value
    : 'development';
}

/** The Compte Kete's self-description (FR-008): who it is and the events it announces. */
export function manifest(): Manifest {
  return parseManifest({
    product: PRODUCT,
    name: 'Compte Kete',
    version,
    environment: environment(),
    events: [...DECLARED_EVENTS],
    // Its identity card (doctrine D-040): people's accounts and their secrets, subscriptions; every
    // Kete app signs in through it, so an outage stops them all.
    governance: {
      owner: { name: 'Kete' },
      dataCategories: ['personal', 'credentials', 'financial'],
      ai: { used: false },
      criticality: 'critical',
    },
  });
}

export const health: HealthOptions = {
  version,
  dependencies: [{ name: 'database', probe: () => db.execute(sql`select 1`) }],
  // Events waiting to be delivered to Kete Cockpit.
  backlog: () => outboxBacklog(getPool()),
};
