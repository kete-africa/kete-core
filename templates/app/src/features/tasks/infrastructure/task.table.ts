import { newId } from '@kete/records';
import { organizationPolicySql, type SqlExecutor } from '@kete/tenancy';
import type { Task, TaskStatus } from '../task.record';

/** The tasks table, with its row-level security in the same migration (constitution V). */
export function tasksMigrationSql(options: { schema: string; appRole: string }): string {
  return `
create table ${options.schema}.tasks (
  task_id text primary key,
  organization_id text not null,
  title text not null check (length(title) between 1 and 200),
  due_on date,
  status text not null default 'open' check (status in ('open', 'done')),
  created_by text not null,
  created_at timestamptz not null default now()
);
create index tasks_open on ${options.schema}.tasks (organization_id, status, due_on);
${organizationPolicySql({ schema: options.schema, table: 'tasks', appRole: options.appRole })}
grant select, insert, update on ${options.schema}.tasks to ${options.appRole};
`;
}

type Row = {
  task_id: string;
  title: string;
  due_on: string | null;
  status: TaskStatus;
  created_at: Date;
};

const toTask = (row: Row): Task => ({
  taskId: row.task_id,
  title: row.title,
  dueOn: row.due_on,
  status: row.status,
  createdAt: row.created_at,
});

const columns = `task_id, title, to_char(due_on, 'YYYY-MM-DD') as due_on, status, created_at`;

export async function insertTask(
  db: SqlExecutor,
  task: { organizationId: string; title: string; dueOn?: string | undefined; createdBy: string },
): Promise<Task> {
  const { rows } = await db.query<Row>(
    `insert into tasks (task_id, organization_id, title, due_on, created_by)
     values ($1, $2, $3, $4, $5) returning ${columns}`,
    [newId('tsk'), task.organizationId, task.title, task.dueOn ?? null, task.createdBy],
  );
  return toTask(rows[0] as Row);
}

export async function findTask(db: SqlExecutor, taskId: string): Promise<Task | null> {
  const { rows } = await db.query<Row>(`select ${columns} from tasks where task_id = $1`, [taskId]);
  return rows[0] ? toTask(rows[0]) : null;
}

export async function listTasks(db: SqlExecutor, status?: TaskStatus): Promise<Task[]> {
  const { rows } = await db.query<Row>(
    `select ${columns} from tasks
      where ($1::text is null or status = $1)
      order by status, due_on nulls last, created_at`,
    [status ?? null],
  );
  return rows.map(toTask);
}

export async function setStatus(
  db: SqlExecutor,
  taskId: string,
  status: TaskStatus,
): Promise<void> {
  await db.query(`update tasks set status = $2 where task_id = $1`, [taskId, status]);
}
