import {
  defineCapability,
  type CapabilityContext,
  type CapabilityDefinition,
} from '@kete/capabilities';
import { defineCommand } from '@kete/commands';
import { z } from 'zod';
import type { ImportedTool } from './tool.js';

// Imported tools as Kete capabilities (spec 124): the same rules as the product's own — a read is
// level 1, an act is a draft a person decides (level 3), a destruction needs her confirmation in
// the product (level 4). Every call goes through the host's gesture: its permission, its
// policies, its journal.

/** The record type of an imported tool's draft: the call a person is asked to make. */
export const TOOL_CALL_DRAFT = 'imported_tool_call';

export interface ToolCapabilitiesOptions {
  /** Calls the tool server-side, with the organization's connection. */
  call(
    tool: ImportedTool,
    input: Record<string, unknown>,
    context: CapabilityContext,
  ): Promise<unknown>;
  /** The permissions that read and that act with imported tools (default `tools:read`, `tools:act`). */
  permissions?: { read: string; act: string };
}

/** An imported tool's input as a schema; what no schema says stays open. */
export function inputOf(tool: ImportedTool): z.ZodObject {
  try {
    const schema = z.fromJSONSchema(tool.inputSchema as Parameters<typeof z.fromJSONSchema>[0]);
    if (schema instanceof z.ZodObject) return schema;
  } catch {
    // An unusual schema: the tool's own server checks its input.
  }
  return z.looseObject({});
}

export function toolCapabilities(
  tools: readonly ImportedTool[],
  options: ToolCapabilitiesOptions,
): CapabilityDefinition[] {
  const permissions = options.permissions ?? { read: 'tools:read', act: 'tools:act' };
  return tools.map((tool) => {
    const input = inputOf(tool);
    const common = {
      name: tool.name,
      description: tool.description,
      input,
      // An imported tool's answer stays inside the organization unless said otherwise.
      classification: 'confidential' as const,
    };
    if (tool.effect === 'read') {
      return defineCapability({
        ...common,
        permission: permissions.read,
        autonomy: 1,
        run: (value, context) => options.call(tool, value as Record<string, unknown>, context),
      });
    }
    const command = defineCommand({
      name: tool.name.replace(/_/g, '-'),
      input,
      reversibility: { reversible: false },
      handler: (value, context) =>
        options.call(tool, value as Record<string, unknown>, {
          db: context.db,
          organizationId: context.organizationId,
          actor: context.actor,
        }),
      summarize: () => `${tool.name} called`,
    });
    return defineCapability({
      ...common,
      permission: permissions.act,
      autonomy: tool.effect === 'destroy' ? 4 : 3,
      command,
      draft: { recordType: TOOL_CALL_DRAFT },
    });
  }) as CapabilityDefinition[];
}
