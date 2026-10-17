import type { Databases, HostedStatus, Hosting } from './ports.js';

// The provisioning port in memory (spec 121): for tests, demos and a product's own previews when no
// provider is configured. It behaves as the real adapters do: twice is harmless, gone is gone.

export interface MemoryInfrastructure {
  databases: Databases & { readonly names: ReadonlySet<string> };
  hosting: Hosting & {
    readonly apps: ReadonlyMap<
      string,
      { name: string; domain: string; env: Record<string, string>; deployed: boolean }
    >;
  };
}

export function memoryInfrastructure(
  options: { fail?: Partial<Record<'database' | 'app' | 'environment' | 'deploy', boolean>> } = {},
): MemoryInfrastructure {
  const names = new Set<string>();
  const apps = new Map<
    string,
    { name: string; domain: string; env: Record<string, string>; deployed: boolean }
  >();
  let next = 0;
  const refuse = (what: keyof NonNullable<typeof options.fail>) => {
    if (options.fail?.[what]) throw new Error(`The provider refused: ${what}.`);
  };
  return {
    databases: {
      names,
      async create(name) {
        refuse('database');
        names.add(name);
        return {
          ownerUrl: `postgres://${name}_owner@memory/${name}`,
          appUrl: `postgres://${name}_app@memory/${name}`,
        };
      },
      async destroy(name) {
        names.delete(name);
      },
    },
    hosting: {
      apps,
      async ensureApp(input) {
        refuse('app');
        const existing = [...apps].find(([, app]) => app.name === input.name);
        if (existing) return { id: existing[0] };
        const id = `app-${++next}`;
        apps.set(id, { name: input.name, domain: input.domain, env: {}, deployed: false });
        return { id };
      },
      async setEnv(id, runtime, build) {
        refuse('environment');
        const app = apps.get(id);
        if (!app) throw new Error(`No app ${id}.`);
        app.env = { ...app.env, ...runtime, ...build };
      },
      async deploy(id) {
        refuse('deploy');
        const app = apps.get(id);
        if (!app) throw new Error(`No app ${id}.`);
        app.deployed = true;
      },
      async status(id): Promise<HostedStatus> {
        const app = apps.get(id);
        return !app ? 'unknown' : app.deployed ? 'running' : 'stopped';
      },
      async destroy(id) {
        apps.delete(id);
      },
    },
  };
}
