// An organization's own tool, imported (spec 124): what it is called, what it does, what it takes,
// and how far it goes — reading, acting, or destroying. Its effect decides its autonomy: an agent
// reads alone, acts by a draft a person decides, destroys only with her confirmation.

export type ToolEffect = 'read' | 'act' | 'destroy';

export type ToolSource =
  | { kind: 'openapi'; method: string; path: string; parameters: OpenApiParameter[]; body: boolean }
  | { kind: 'mcp'; tool: string };

export interface OpenApiParameter {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
}

export interface ImportedTool {
  /** snake_case, prefixed by the import: `crm_contacts_list`. */
  name: string;
  description: string;
  /** Its input, as JSON Schema (an object). */
  inputSchema: Record<string, unknown>;
  effect: ToolEffect;
  source: ToolSource;
}

/** A name every tool host accepts: lower snake_case, 63 characters at most, unique. */
export function toolName(prefix: string, raw: string, taken: Set<string>): string {
  const base = `${prefix}_${raw}`
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([^a-z])/, 't_$1')
    .slice(0, 63)
    .replace(/_+$/, '');
  let name = base;
  for (let n = 2; taken.has(name); n += 1) name = `${base.slice(0, 60)}_${n}`;
  taken.add(name);
  return name;
}

export class ToolError extends Error {
  constructor(
    readonly code: 'invalid_description' | 'refused' | 'unreachable' | 'unknown_tool',
    message: string,
  ) {
    super(message);
    this.name = 'ToolError';
  }
}
