import { PgBoss } from 'pg-boss';

/** A kind of job: its queue, how it retries, what it does, and when it runs on its own. */
export interface JobDefinition<Data extends object = object> {
  /** kebab-case: `send-email`, `relay-events`. */
  name: string;
  /** Attempts after the first failure (default 3). */
  retryLimit?: number;
  /** Seconds before the first retry (default 30), doubled each time when `retryBackoff`. */
  retryDelay?: number;
  retryBackoff?: boolean;
  /** A cron expression, in UTC: the job also runs on this schedule, with no data. */
  schedule?: string;
  /** Throwing retries the job; returning completes it. */
  handle(data: Data): Promise<void>;
}

const jobName = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Declares a job; its shape is checked once, at start-up. */
export function defineJob<Data extends object>(job: JobDefinition<Data>): JobDefinition<Data> {
  if (!jobName.test(job.name)) throw new Error(`A job is named in kebab-case: ${job.name}`);
  return job;
}

export interface JobsOptions {
  /**
   * The role that owns the jobs' schema. It never touches the app's tables: a job's work goes
   * through the app's own pool, under row-level security.
   */
  connectionString: string;
  /** Default `kete_jobs`. */
  schema?: string;
  jobs: JobDefinition<never>[];
  /** False for a web process that only sends jobs; the worker process works them. */
  work?: boolean;
}

export interface Jobs {
  /** Queues a job; a `singletonKey` makes a repeated send harmless while the first one waits. */
  send(
    name: string,
    data: object,
    options?: { singletonKey?: string; startAfter?: Date },
  ): Promise<string | null>;
  start(): Promise<void>;
  /** Waits for the jobs at work, then stops. */
  stop(): Promise<void>;
}

/**
 * Background jobs on the app's Postgres (pg-boss): no other server to run. One image, two roles
 * (doctrine ARCHITECTURE_APP §9): the web process sends, the worker process works.
 */
export function createJobs(options: JobsOptions): Jobs {
  const byName = new Map<string, JobDefinition<never>>();
  for (const job of options.jobs) {
    if (byName.has(job.name)) throw new Error(`Duplicate job: ${job.name}`);
    byName.set(job.name, job);
  }
  const boss = new PgBoss({
    connectionString: options.connectionString,
    schema: options.schema ?? 'kete_jobs',
  });
  boss.on('error', (error: Error) => console.error(`[jobs] ${error.message}`));

  return {
    async start() {
      await boss.start();
      for (const job of byName.values()) {
        await boss.createQueue(job.name, {
          retryLimit: job.retryLimit ?? 3,
          retryDelay: job.retryDelay ?? 30,
          retryBackoff: job.retryBackoff ?? true,
        });
        if (options.work === false) continue;
        await boss.work<object>(job.name, async (batch) => {
          for (const item of batch) await job.handle(item.data as never);
        });
        if (job.schedule) await boss.schedule(job.name, job.schedule);
      }
    },
    async send(name, data, sendOptions = {}) {
      if (!byName.has(name)) throw new Error(`Unknown job: ${name}`);
      return boss.send(name, data, {
        ...(sendOptions.singletonKey ? { singletonKey: sendOptions.singletonKey } : {}),
        ...(sendOptions.startAfter ? { startAfter: sendOptions.startAfter } : {}),
      });
    },
    async stop() {
      await boss.stop({ graceful: true, timeout: 30_000 });
    },
  };
}
