import { defineCommand } from '@kete/commands';
import { insertTask } from '../infrastructure/task.table';
import { taskInput } from '../task.record';

/** Adds a task: the same command for a screen, an agent's validated draft and the API. */
export const createTask = defineCommand({
  name: 'create-task',
  input: taskInput,
  reversibility: { reversible: false },
  handler: (input, { db, organizationId, actor }) =>
    insertTask(db, { organizationId, title: input.title, dueOn: input.dueOn, createdBy: actor.id }),
  summarize: (input) => `Task "${input.title}" added`,
});
