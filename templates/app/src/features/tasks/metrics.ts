import { MetricDenied } from '@kete/metrics/server';
import type { MetricDefinition } from '@kete/metrics';
import type { Metric } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import app from '../../../kete.json' with { type: 'json' };
import { transaction } from '@/platform/db';
import { currentIdentity, holds } from '@/platform/rights';
import { countOpenTasks } from './infrastructure/task.table';

// The figures of tasks (kete-core spec 103): declared once in kete.json, computed here within the
// reader's rights — whoever may not read tasks reads no figure of them.

const declared = (name: string): Metric => {
  const metric = (app.metrics as Metric[]).find((m) => m.name === name);
  if (!metric) throw new Error(`kete.json does not declare ${name}.`);
  return metric;
};

async function readTasks<T>(work: (db: SqlExecutor) => Promise<T>) {
  const organizationId = currentIdentity()?.organizationId;
  if (!organizationId || !holds('tasks:read')) throw new MetricDenied();
  return transaction(organizationId, work);
}

const today = () => new Date().toISOString().slice(0, 10);

export const taskMetrics: MetricDefinition[] = [
  { metric: declared('tasks.open'), compute: () => readTasks((db) => countOpenTasks(db)) },
  {
    metric: declared('tasks.overdue'),
    compute: () => readTasks((db) => countOpenTasks(db, today())),
  },
];
