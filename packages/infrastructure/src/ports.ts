// The provisioning port (spec 121; kete-core decision 0009: a port ships with its adapter): what
// creating a Kete instance needs from the outside world. Vendor names stay in the adapters.

/** A copy of a database as it was, kept apart from it (spec 131). */
export interface Backup {
  id: string;
  /** What the provider calls it: `kya_enterprise--bk-20261018T0530`. */
  name: string;
  /** When it was taken (ISO 8601). */
  at: string;
}

export interface Databases {
  /** A database of its own, with an owner role and an application role (no BYPASSRLS). Twice is harmless. */
  create(name: string): Promise<{ ownerUrl: string; appUrl: string }>;
  /** The database, its two roles and its backups, gone. Harmless when already gone. */
  destroy(name: string): Promise<void>;
  /** A copy of the database as it is now, kept apart from it. */
  backup(name: string): Promise<Backup>;
  /** Its backups, the latest first. */
  backups(name: string): Promise<Backup[]>;
  /**
   * The database as it was at a backup, at the same address; what it was just before is kept as
   * a backup too, so a restore is undone by another.
   */
  restore(name: string, backupId: string): Promise<{ before: Backup }>;
}

export type HostedStatus = 'running' | 'starting' | 'stopped' | 'failed' | 'unknown';

export interface Hosting {
  /** The app at its address, from its repository or its image; twice is harmless. */
  ensureApp(input: {
    name: string;
    repository: string;
    domain: string;
    description: string;
  }): Promise<{ id: string }>;
  /** Its environment: runtime variables, and build-time ones (a packages token). */
  setEnv(id: string, runtime: Record<string, string>, build: Record<string, string>): Promise<void>;
  /** Builds and starts it; the deployment's id, to follow it, when the provider gives one. */
  deploy(id: string): Promise<string | null>;
  /** Where a deployment stands. */
  deployment(deploymentId: string): Promise<'pending' | 'done' | 'failed'>;
  status(id: string): Promise<HostedStatus>;
  /** The version it builds: a commit or a tag; null when it follows its branch. */
  version(id: string): Promise<string | null>;
  /** Pins the version it builds at the next deployment; null follows its branch again. */
  pin(id: string, version: string | null): Promise<void>;
  /** Starts it again as it is: its connections renew (after a restore). */
  restart(id: string): Promise<void>;
  /** The app and its resources, gone. Harmless when already gone. */
  destroy(id: string): Promise<void>;
}

export interface ProvisioningPorts {
  databases: Databases;
  hosting: Hosting;
  /** Whether the instance answers at its address (its `/health`). */
  probe(url: string): Promise<boolean>;
}
