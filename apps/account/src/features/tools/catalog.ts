/**
 * The Kete apps shown in "My tools". Static until subscriptions (spec 003, assumptions); an app
 * without a configured address is listed but cannot be opened yet.
 */
export interface ToolEntry {
  id: 'firmo' | 'nettio' | 'nyatefe' | 'cockpit';
  name: string;
  url: string | null;
}

export function toolCatalog(env: NodeJS.ProcessEnv = process.env): ToolEntry[] {
  return [
    { id: 'firmo', name: 'Firmo', url: env.KETE_TOOL_FIRMO_URL ?? null },
    { id: 'nettio', name: 'Nettio', url: env.KETE_TOOL_NETTIO_URL ?? null },
    { id: 'nyatefe', name: 'Nyatefe', url: env.KETE_TOOL_NYATEFE_URL ?? null },
    { id: 'cockpit', name: 'Kete Cockpit', url: env.KETE_TOOL_COCKPIT_URL ?? null },
  ];
}
