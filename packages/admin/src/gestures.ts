import type { KeteIdentity } from '@kete/auth';
import { executeCommand, type CommandDefinition, type CommandResult } from '@kete/commands';
import type { SqlExecutor } from '@kete/tenancy';
import type { z } from 'zod';
import { AdminError, operatorActor } from './operators.js';

/** Who acts, and the key that makes a retried request harmless. */
export interface OperatorGesture {
  identity: KeteIdentity;
  idempotencyKey: string;
}

/** Runs `work` in a transaction of the organization (`inOrganization` of @kete/tenancy). */
export type OrganizationTransaction = <T>(
  organizationId: string,
  work: (db: SqlExecutor) => Promise<T>,
) => Promise<T>;

/**
 * An operator gesture is a named command (@kete/commands): journaled with the operator, the channel
 * and whether it can be undone, in the operators' organization.
 */
export function runOperatorGesture<Input extends z.ZodType, Output>(
  transaction: OrganizationTransaction,
  command: CommandDefinition<Input, Output>,
  gesture: OperatorGesture,
  input: z.input<Input>,
): Promise<CommandResult<Output>> {
  const organizationId = gesture.identity.organizationId;
  if (!organizationId) throw new AdminError(403, 'not_an_operator');
  return transaction(organizationId, (db) =>
    executeCommand(db, command, {
      organizationId,
      actor: operatorActor(gesture.identity),
      idempotencyKey: gesture.idempotencyKey,
      input,
    }),
  );
}
