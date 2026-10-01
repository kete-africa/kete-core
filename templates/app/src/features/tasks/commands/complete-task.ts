import { defineCommand } from '@kete/commands';
import { z } from 'zod';
import { completed, reopened, TaskRuleError } from '../domain/task';
import { findTask, setStatus } from '../infrastructure/task.table';

const taskRef = z.object({ taskId: z.string().min(1).max(64) });

/** Marks a task done; reopening it undoes that, so an agent may do it alone (level 2). */
export const completeTask = defineCommand({
  name: 'complete-task',
  input: taskRef,
  reversibility: { reversible: true, inverse: 'reopen-task' },
  async handler({ taskId }, { db }) {
    const task = await findTask(db, taskId);
    if (!task) throw new TaskRuleError('not_found');
    await setStatus(db, taskId, completed(task.status));
    return { taskId, status: 'done' as const };
  },
  summarize: ({ taskId }) => `Task ${taskId} done`,
});

export const reopenTask = defineCommand({
  name: 'reopen-task',
  input: taskRef,
  reversibility: { reversible: true, inverse: 'complete-task' },
  async handler({ taskId }, { db }) {
    const task = await findTask(db, taskId);
    if (!task) throw new TaskRuleError('not_found');
    await setStatus(db, taskId, reopened(task.status));
    return { taskId, status: 'open' as const };
  },
  summarize: ({ taskId }) => `Task ${taskId} reopened`,
});
