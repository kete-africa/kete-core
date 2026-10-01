import { createCapabilityRegistry } from '@kete/capabilities';
import { taskCapabilities } from '@/features/tasks';
import { transaction } from './db';
import { holds } from './rights';

/**
 * Every gesture of the app, the same for its screens, its MCP endpoint and its agents: same
 * rights, same journal, same autonomy rules (@kete/capabilities).
 */
export const registry = createCapabilityRegistry([...taskCapabilities], {
  authorize: async (_caller, permission) => holds(permission),
  transaction,
});
