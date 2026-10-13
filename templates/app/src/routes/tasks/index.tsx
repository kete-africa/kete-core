import { ErrorNote, Panel } from '@kete/design';
import { useState } from 'react';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { addTask, fetchTasks, readTask } from '@/features/tasks/functions';
import { TaskIntake } from '@/features/tasks/ui/TaskIntake';
import { TaskForm } from '@/features/tasks/ui/TaskForm';
import { TaskList } from '@/features/tasks/ui/TaskList';
import { sayError } from '@/lib/errors';
import { AppShell } from '@/lib/shell';
import { requirePerson } from '@/lib/signed-in';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/taches')({
  beforeLoad: ({ location }) => requirePerson(location.href),
  loader: () => fetchTasks(),
  component: TasksPage,
});

function TasksPage() {
  const tasks = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [read, setRead] = useState<string | null>(null);
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-headline font-semibold">{m.tasks_title()}</h1>
        <Panel>
          <TaskForm
            onAdd={async (task) => {
              const outcome = await addTask({ data: task });
              setError(outcome.ok ? null : sayError(outcome.code));
              await router.invalidate();
            }}
          />
          <ErrorNote>{error}</ErrorNote>
        </Panel>
        <Panel title={m.intake_title()}>
          <TaskIntake
            onRead={async (input) => {
              const outcome = await readTask({ data: input });
              if (outcome.status === 'draft') {
                await navigate({
                  to: '/verification/$draftId',
                  params: { draftId: outcome.draftId },
                });
                return;
              }
              setRead(
                outcome.status === 'incomplete'
                  ? m.intake_incomplete({ fields: outcome.missing.join(', ') })
                  : outcome.status === 'not_connected'
                    ? m.ask_not_connected()
                    : m.errors_generic(),
              );
            }}
          />
          <ErrorNote>{read}</ErrorNote>
        </Panel>
        <TaskList tasks={tasks} />
      </div>
    </AppShell>
  );
}
