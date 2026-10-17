// The provisioning port (spec 121; kete-core decision 0009: a port ships with its adapter): what
// creating a Kete instance needs from the outside world. Vendor names stay in the adapters.

export interface Databases {
  /** A database of its own, with an owner role and an application role (no BYPASSRLS). Twice is harmless. */
  create(name: string): Promise<{ ownerUrl: string; appUrl: string }>;
  /** The database and its two roles, gone. Harmless when already gone. */
  destroy(name: string): Promise<void>;
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
  deploy(id: string): Promise<void>;
  status(id: string): Promise<HostedStatus>;
  /** The app and its resources, gone. Harmless when already gone. */
  destroy(id: string): Promise<void>;
}

export interface ProvisioningPorts {
  databases: Databases;
  hosting: Hosting;
  /** Whether the instance answers at its address (its `/health`). */
  probe(url: string): Promise<boolean>;
}
