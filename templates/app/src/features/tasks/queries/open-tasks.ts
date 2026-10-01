import type { SqlExecutor } from '@kete/tenancy';
import { listTasks } from '../infrastructure/task.table';
import type { Task } from '../task.record';

/** The tasks still to do, soonest first. */
export function openTasks(db: SqlExecutor): Promise<Task[]> {
  return listTasks(db, 'open');
}
