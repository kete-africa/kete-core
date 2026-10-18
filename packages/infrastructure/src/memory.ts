import type { Backup, Databases, HostedStatus, Hosting } from './ports.js';

// The provisioning port in memory (spec 121): for tests, demos and a product's own previews when no
// provider is configured. It behaves as the real adapters do: twice is harmless, gone is gone; a
// database holds one value a test writes, so a backup and its restore can be seen (spec 131).

interface MemoryApp {
  name: string;
  domain: string;
  env: Record<string, string>;
  deployed: boolean;
  /** The version pinned for the next deployment; null follows the branch. */
  pinned: string | null;
  /** The version running; `branch` when it follows its branch. */
  running: string | null;
  restarts: number;
}

export interface MemoryInfrastructure {
  databases: Databases & {
    readonly names: ReadonlySet<string>;
    /** What a database holds, as a test wrote it. */
    readonly contents: Map<string, unknown>;
  };
  hosting: Hosting & { readonly apps: ReadonlyMap<string, MemoryApp> };
  /** Whether an app answers at its address: deployed, and not on a version that breaks. */
  answers(url: string): boolean;
}

export function memoryInfrastructure(
  options: {
    fail?: Partial<Record<'database' | 'app' | 'environment' | 'deploy', boolean>>;
    /** Versions whose deployment fails. */
    broken?: readonly string[];
    /** Versions that deploy but never answer. */
    silent?: readonly string[];
  } = {},
): MemoryInfrastructure {
  const names = new Set<string>();
  const contents = new Map<string, unknown>();
  const kept = new Map<string, (Backup & { content: unknown })[]>();
  const apps = new Map<string, MemoryApp>();
  const deployments = new Map<string, 'done' | 'failed'>();
  let next = 0;
  let clock = Date.parse('2026-10-18T05:00:00Z');
  const refuse = (what: keyof NonNullable<typeof options.fail>) => {
    if (options.fail?.[what]) throw new Error(`The provider refused: ${what}.`);
  };
  const take = (name: string, suffix = ''): Backup & { content: unknown } => {
    clock += 60_000;
    const at = new Date(clock).toISOString();
    const backup = {
      id: `bk-${++next}`,
      name: `${name}--bk-${at.replace(/[-:]/g, '').slice(0, 13)}${suffix}`,
      at,
      content: structuredClone(contents.get(name)),
    };
    kept.set(name, [backup, ...(kept.get(name) ?? [])]);
    return backup;
  };
  const shown = ({ id, name, at }: Backup): Backup => ({ id, name, at });
  const app = (id: string) => {
    const found = apps.get(id);
    if (!found) throw new Error(`No app ${id}.`);
    return found;
  };
  return {
    answers(url) {
      return [...apps.values()].some(
        (one) =>
          one.deployed &&
          url.includes(one.domain) &&
          !(options.silent ?? []).includes(one.running ?? ''),
      );
    },
    databases: {
      names,
      contents,
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
        contents.delete(name);
        kept.delete(name);
      },
      async backup(name) {
        if (!names.has(name)) throw new Error(`No database ${name}.`);
        return shown(take(name));
      },
      async backups(name) {
        return (kept.get(name) ?? []).map(shown);
      },
      async restore(name, backupId) {
        const backup = (kept.get(name) ?? []).find((one) => one.id === backupId);
        if (!backup) throw new Error(`No backup ${backupId} of ${name}.`);
        const before = take(name, '-before');
        contents.set(name, structuredClone(backup.content));
        return { before: shown(before) };
      },
    },
    hosting: {
      apps,
      async ensureApp(input) {
        refuse('app');
        const existing = [...apps].find(([, one]) => one.name === input.name);
        if (existing) return { id: existing[0] };
        const id = `app-${++next}`;
        apps.set(id, {
          name: input.name,
          domain: input.domain,
          env: {},
          deployed: false,
          pinned: null,
          running: null,
          restarts: 0,
        });
        return { id };
      },
      async setEnv(id, runtime, build) {
        refuse('environment');
        const one = app(id);
        one.env = { ...one.env, ...runtime, ...build };
      },
      async deploy(id) {
        refuse('deploy');
        const one = app(id);
        const deploymentId = `dpl-${++next}`;
        if ((options.broken ?? []).includes(one.pinned ?? '')) {
          deployments.set(deploymentId, 'failed');
          return deploymentId;
        }
        one.deployed = true;
        one.running = one.pinned;
        deployments.set(deploymentId, 'done');
        return deploymentId;
      },
      async deployment(deploymentId) {
        return deployments.get(deploymentId) ?? 'pending';
      },
      async status(id): Promise<HostedStatus> {
        const one = apps.get(id);
        return !one ? 'unknown' : one.deployed ? 'running' : 'stopped';
      },
      async version(id) {
        return app(id).running;
      },
      async pin(id, version) {
        app(id).pinned = version;
      },
      async restart(id) {
        app(id).restarts += 1;
      },
      async destroy(id) {
        apps.delete(id);
      },
    },
  };
}
