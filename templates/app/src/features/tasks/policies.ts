import type { Role } from '@/platform/rights';

/**
 * Who may do what with tasks, by organization role. Checked on the server for every surface: a
 * screen, the MCP endpoint, an agent acting for a person.
 */
export const taskPermissions: Record<Role, string[]> = {
  owner: ['tasks:read', 'tasks:write', 'tasks:create'],
  admin: ['tasks:read', 'tasks:write', 'tasks:create'],
  member: ['tasks:read', 'tasks:write'],
};
