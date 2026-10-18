import type { Instance } from './provision.js';
import type { Backup, ProvisioningPorts } from './ports.js';

// Running instances through the provisioning port alone (spec 131, phase 11 step B2): a version
// pushed to several instances one after the other, each waited for until it answers, the previous
// version put back on one that does not — and the rollout stopped there; a backup taken, and an
// instance brought back to it, the state just before kept.

export interface OperateOptions {
  /** How long to wait for an instance to answer, in seconds (default 900). */
  waitSeconds?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface UpdateReport {
  name: string;
  /** The version it ran before; null when it followed its branch. */
  from: string | null;
  to: string;
  /**
   * `updated`: it answers on the new version. `rolled_back`: it did not, and runs its previous one
   * again. `failed`: neither answers — an operator is needed. `skipped`: the rollout stopped before.
   */
  outcome: 'updated' | 'rolled_back' | 'failed' | 'skipped';
  reason?: string;
}

type Running = Pick<Instance, 'name' | 'hostingId' | 'url'>;

/** Deploys what is pinned and waits until the deployment ends and the instance answers. */
async function deployed(
  ports: ProvisioningPorts,
  instance: Running,
  options: OperateOptions,
): Promise<string | null> {
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const until = now() + (options.waitSeconds ?? 900) * 1000;
  const deployment = await ports.hosting.deploy(instance.hostingId);
  for (;;) {
    const state = deployment ? await ports.hosting.deployment(deployment) : 'done';
    if (state === 'failed') return 'the deployment failed';
    if (state === 'done' && (await ports.probe(instance.url))) return null;
    if (now() >= until) return 'it did not answer in time';
    await sleep(10_000);
  }
}

/**
 * Pushes a version (a commit or a tag) to instances, one after the other. One that does not answer
 * on it gets its previous version back, and the instances after it are left as they are.
 */
export async function updateInstances(
  ports: ProvisioningPorts,
  instances: readonly Running[],
  version: string,
  options: OperateOptions & { onInstance?: (report: UpdateReport) => void } = {},
): Promise<UpdateReport[]> {
  const reports: UpdateReport[] = [];
  let stopped = false;
  for (const instance of instances) {
    const from = await ports.hosting.version(instance.hostingId);
    let report: UpdateReport;
    if (stopped) {
      report = { name: instance.name, from, to: version, outcome: 'skipped' };
    } else {
      await ports.hosting.pin(instance.hostingId, version);
      const failure = await deployed(ports, instance, options);
      if (!failure) {
        report = { name: instance.name, from, to: version, outcome: 'updated' };
      } else {
        stopped = true;
        await ports.hosting.pin(instance.hostingId, from);
        const back = await deployed(ports, instance, options);
        report = {
          name: instance.name,
          from,
          to: version,
          outcome: back ? 'failed' : 'rolled_back',
          reason: back ? `${failure}; its previous version: ${back}` : failure,
        };
      }
    }
    reports.push(report);
    options.onInstance?.(report);
  }
  return reports;
}

/** A backup of an instance's database, as it is now. */
export function backupInstance(
  ports: ProvisioningPorts,
  instance: Pick<Instance, 'database'>,
): Promise<Backup> {
  return ports.databases.backup(instance.database);
}

/**
 * An instance brought back to a backup: its database restored at the same address, the instance
 * started again so its connections renew, and waited for until it answers.
 */
export async function restoreInstance(
  ports: ProvisioningPorts,
  instance: Pick<Instance, 'database' | 'hostingId' | 'url'>,
  backupId: string,
  options: OperateOptions = {},
): Promise<{ before: Backup }> {
  const restored = await ports.databases.restore(instance.database, backupId);
  await ports.hosting.restart(instance.hostingId);
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const until = now() + (options.waitSeconds ?? 900) * 1000;
  while (!(await ports.probe(instance.url))) {
    if (now() >= until) throw new Error('The instance did not answer after its restore.');
    await sleep(10_000);
  }
  return restored;
}
