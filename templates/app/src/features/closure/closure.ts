import { understand, type GestureOffer } from '@kete/ai';
import type { KeteIdentity } from '@kete/auth';
import { performGesture } from '@kete/capabilities';
import { executeCommand } from '@kete/commands';
import {
  applySet,
  dismissSet,
  getProposalSet,
  proposeSet,
  undoSet,
  type StoredProposalSet,
} from '@kete/drafts';
import type { ProposalSet } from '@kete/sdk';
import { randomUUID } from 'node:crypto';
import { reopenTask } from '@/features/tasks/commands/complete-task';
import { listTasks } from '@/features/tasks/infrastructure/task.table';
import { getModel } from '@/platform/ai';
import { transaction } from '@/platform/db';
import { registry } from '@/platform/registry';
import { holds } from '@/platform/rights';
import { screenActor } from '@/platform/session';

// The evening's closure (kete-core spec 104; doctrine D-051): she writes or says what her day was;
// the assistant proposes gestures on her open tasks — never on what she does not have — she ticks
// them, applies them together, and may undo them together. Replace the offers with the gestures of
// the app's trade.

/** The gestures the closure may propose: each one a capability of the app. */
const offers: GestureOffer[] = [
  {
    gesture: 'close',
    describe: 'close a task she says is done',
    level: 2,
    capability: 'tasks_complete',
    inputOf: ({ object }) => ({ taskId: object?.key }),
  },
];

/** Undoes an applied gesture, by its capability; what has no way back is not undone. */
const undoers: Record<string, (caller: Caller, input: Record<string, unknown>) => Promise<void>> = {
  tasks_complete: async (caller, input) => {
    await transaction(caller.organizationId, (db) =>
      executeCommand(db, reopenTask, {
        ...caller,
        idempotencyKey: `closure-undo-${randomUUID()}`,
        input: { taskId: String(input['taskId']) },
      }),
    );
  },
};

type Caller = { actor: ReturnType<typeof screenActor>; organizationId: string };
type As = <T>(work: () => T | Promise<T>) => Promise<T>;

export type Understood =
  | { status: 'not_connected' }
  | { status: 'nothing'; unclear: string[] }
  | { status: 'proposed'; set: StoredProposalSet; unclear: string[] };

/** What her note proposes, on her open tasks; kept for her to decide. */
export async function understandDay(
  identity: KeteIdentity,
  text: string,
  as: As,
  today = new Date().toISOString().slice(0, 10),
): Promise<Understood> {
  const model = getModel();
  const organizationId = identity.organizationId;
  if (!model || !organizationId) return { status: 'not_connected' };
  const tasks = await as(() =>
    holds('tasks:read') ? transaction(organizationId, (db) => listTasks(db, 'open')) : [],
  );
  const { items, unclear } = await understand({
    model,
    text,
    today,
    known: tasks.map((task) => ({
      key: task.taskId,
      kind: 'task',
      label: task.title,
      ...(task.dueOn ? { due: task.dueOn } : {}),
    })),
    offers,
  });
  if (items.length === 0) return { status: 'nothing', unclear };
  const set = await transaction(organizationId, (db) =>
    proposeSet(db, organizationId, {
      origin: 'closure',
      for: identity.userId,
      items: items as ProposalSet['items'],
    }),
  );
  return { status: 'proposed', set, unclear };
}

/** Her set, or nothing: another person's set is not hers to decide. */
async function hers(identity: KeteIdentity, id: string) {
  const organizationId = identity.organizationId;
  if (!organizationId) return null;
  const stored = await transaction(organizationId, (db) => getProposalSet(db, id));
  return stored?.set.for === identity.userId ? { stored, organizationId } : null;
}

/** Applies what she ticked, together — each through its capability, under her rights. */
export async function applyDay(
  identity: KeteIdentity,
  id: string,
  ticked: readonly string[],
  as: As,
): Promise<StoredProposalSet | null> {
  const found = await hers(identity, id);
  if (!found) return null;
  const caller = { actor: screenActor(identity), organizationId: found.organizationId };
  return transaction(found.organizationId, (db) =>
    applySet(db, id, {
      by: caller.actor,
      ticked,
      apply: async (item) => {
        if (!item.capability) return { ok: false, reason: 'no_capability' };
        const outcome = await performGesture(
          registry,
          { ...caller, name: item.capability, input: item.input ?? {} },
          as,
        );
        return outcome.ok
          ? { ok: true, result: { capability: item.capability, input: item.input ?? {} } }
          : { ok: false, reason: outcome.code };
      },
    }),
  );
}

/** Undoes what was applied, together, the last first. */
export async function undoDay(
  identity: KeteIdentity,
  id: string,
  as: As,
): Promise<StoredProposalSet | null> {
  const found = await hers(identity, id);
  if (!found) return null;
  const caller = { actor: screenActor(identity), organizationId: found.organizationId };
  return transaction(found.organizationId, (db) =>
    undoSet(db, id, {
      by: caller.actor,
      undo: async (item) => {
        const undo = item.capability ? undoers[item.capability] : undefined;
        if (!undo || !(await as(() => holds('tasks:write')))) return false;
        await undo(caller, item.input ?? {});
        return true;
      },
    }),
  );
}

/** She keeps none of it. */
export async function dismissDay(
  identity: KeteIdentity,
  id: string,
): Promise<StoredProposalSet | null> {
  const found = await hers(identity, id);
  if (!found) return null;
  return transaction(found.organizationId, (db) => dismissSet(db, id, screenActor(identity)));
}
