import type { ProvisioningPorts } from './ports.js';

// An instance created through the provisioning port alone (spec 121): its database, its app, its
// environment, its deployment, until it answers. A step that fails undoes what the earlier ones
// made, the latest first, so nothing is left half-built and billed.

export interface InstanceSpec {
  /** `kya-enterprise`: lower case, digits and dashes; its database is `kya_enterprise`. */
  name: string;
  repository: string;
  domain: string;
  description: string;
  /** Runtime variables besides the database's addresses. */
  env?: Record<string, string>;
  /** Build-time variables: a packages token. */
  buildEnv?: Record<string, string>;
  /** How long to wait for it to answer, in seconds (default 600). */
  waitSeconds?: number;
}

/** A provisioned instance; its database addresses are secrets, never logged. */
export interface Instance {
  name: string;
  database: string;
  hostingId: string;
  url: string;
}

export type ProvisionStep = 'database' | 'app' | 'environment' | 'deployment' | 'answer';

export interface ProvisionOptions {
  /** Each step as it starts and ends: what the Cockpit's fleet shows. */
  onStep?: (step: ProvisionStep, state: 'started' | 'done' | 'undone') => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export class ProvisionError extends Error {
  constructor(
    readonly step: ProvisionStep,
    override readonly cause: unknown,
    /** What could not be undone: it is left for an operator, named. */
    readonly leftover: string[],
  ) {
    super(
      `Provisioning failed at « ${step} »${leftover.length ? `; left: ${leftover.join(', ')}` : ''}.`,
    );
    this.name = 'ProvisionError';
  }
}

const NAME = /^[a-z][a-z0-9-]{2,40}$/;
const databaseOf = (name: string) => name.replace(/-/g, '_');

/** Creates an instance step by step; undoes what it made when a step fails. */
export async function provisionInstance(
  ports: ProvisioningPorts,
  spec: InstanceSpec,
  options: ProvisionOptions = {},
): Promise<Instance> {
  if (!NAME.test(spec.name)) throw new RangeError(`Not an instance name: ${spec.name}`);
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const say = options.onStep ?? (() => undefined);
  const database = databaseOf(spec.name);
  const undo: { step: ProvisionStep; what: string; run: () => Promise<void> }[] = [];
  let step: ProvisionStep = 'database';
  try {
    say('database', 'started');
    const urls = await ports.databases.create(database);
    undo.push({ step, what: `database ${database}`, run: () => ports.databases.destroy(database) });
    say('database', 'done');

    step = 'app';
    say('app', 'started');
    const { id } = await ports.hosting.ensureApp({
      name: spec.name,
      repository: spec.repository,
      domain: spec.domain,
      description: spec.description,
    });
    undo.push({ step, what: `app ${id}`, run: () => ports.hosting.destroy(id) });
    say('app', 'done');

    step = 'environment';
    say('environment', 'started');
    await ports.hosting.setEnv(
      id,
      { ...spec.env, DATABASE_URL: urls.appUrl, OWNER_DATABASE_URL: urls.ownerUrl },
      spec.buildEnv ?? {},
    );
    say('environment', 'done');

    step = 'deployment';
    say('deployment', 'started');
    await ports.hosting.deploy(id);
    say('deployment', 'done');

    step = 'answer';
    say('answer', 'started');
    const url = `https://${spec.domain}`;
    const until = now() + (spec.waitSeconds ?? 600) * 1000;
    for (;;) {
      if ((await ports.hosting.status(id)) === 'failed') throw new Error('The deployment failed.');
      if (await ports.probe(url)) break;
      if (now() >= until) throw new Error('The instance did not answer in time.');
      await sleep(10_000);
    }
    say('answer', 'done');
    return { name: spec.name, database, hostingId: id, url };
  } catch (error) {
    const leftover: string[] = [];
    for (const made of undo.reverse()) {
      try {
        await made.run();
        say(made.step, 'undone');
      } catch {
        leftover.push(made.what);
      }
    }
    throw new ProvisionError(step, error, leftover);
  }
}

/** Destroys an instance through the port: its app first, then its database. */
export async function destroyInstance(
  ports: ProvisioningPorts,
  instance: Pick<Instance, 'database' | 'hostingId'>,
): Promise<void> {
  await ports.hosting.destroy(instance.hostingId);
  await ports.databases.destroy(instance.database);
}
