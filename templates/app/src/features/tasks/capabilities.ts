import { defineCapability } from '@kete/capabilities';
import { tableView, VIEWS } from '@kete/views';
import { z } from 'zod';
import * as m from '@/paraglide/messages.js';
import { completeTask } from './commands/complete-task';
import { createTask } from './commands/create-task';
import { openTasks } from './queries/open-tasks';
import { taskInput, taskRecord } from './task.record';

/** What agents may do with tasks — through MCP, the chat or another app — and how far alone. */
export const taskCapabilities = [
  // Level 1: reads, shown as a table in a copilot.
  defineCapability({
    name: 'tasks_list',
    description: 'Lists the tasks still to do, soonest first.',
    permission: 'tasks:read',
    autonomy: 1,
    input: z.object({}),
    view: VIEWS.table,
    async run(_input, { db }) {
      const tasks = await openTasks(db);
      return tableView({
        title: m.tasks_table_title(),
        empty: m.tasks_table_empty(),
        columns: [
          { key: 'title', label: m.task_title_label() },
          { key: 'dueOn', label: m.task_due_label() },
        ],
        rows: tasks.map((task) => ({ title: task.title, dueOn: task.dueOn })),
      });
    },
  }),
  // Level 2: reversible; the agent acts, the person is told and may undo.
  defineCapability({
    name: 'tasks_complete',
    description: 'Marks a task done. It can be reopened.',
    permission: 'tasks:write',
    autonomy: 2,
    input: z.object({ taskId: z.string().min(1).max(64) }),
    command: completeTask,
  }),
  // Level 3: commits; the agent prepares a draft, a person validates it — in her copilot's view.
  defineCapability({
    name: 'tasks_create',
    description: 'Adds a task to the organization.',
    permission: 'tasks:create',
    autonomy: 3,
    input: taskInput,
    command: createTask,
    draft: { recordType: 'task', definition: taskRecord },
  }),
];
