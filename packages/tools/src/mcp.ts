import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { toolName, ToolError, type ImportedTool, type ToolEffect } from './tool.js';

// A tool served by a remote MCP server (spec 124): its tools listed and imported — read-only when
// it says so, destructive unless it says otherwise (MCP's own default) — and called through the
// server with the connection's credential.

/** What the module needs of an MCP client: its tools, and calling one. */
export interface McpTools {
  listTools(): Promise<{
    tools: {
      name: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
      annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
    }[];
  }>;
  callTool(request: { name: string; arguments: Record<string, unknown> }): Promise<{
    isError?: boolean;
    content?: unknown[];
    structuredContent?: unknown;
  }>;
}

function effectOf(
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean } = {},
): ToolEffect {
  if (annotations.readOnlyHint === true) return 'read';
  // MCP: a tool that is not read-only is destructive unless it says it is not.
  return annotations.destructiveHint === false ? 'act' : 'destroy';
}

/** The tools of an MCP server, as imported tools named `<prefix>_<tool>`. */
export async function toolsFromMcp(
  client: McpTools,
  options: { prefix: string },
): Promise<ImportedTool[]> {
  const { tools } = await client.listTools().catch((error: unknown) => {
    throw new ToolError('unreachable', error instanceof Error ? error.message : String(error));
  });
  const taken = new Set<string>();
  return tools.map((tool) => ({
    name: toolName(options.prefix, tool.name, taken),
    description: (tool.description ?? tool.name).slice(0, 1000),
    inputSchema:
      tool.inputSchema && tool.inputSchema.type === 'object'
        ? tool.inputSchema
        : { type: 'object', properties: {} },
    effect: effectOf(tool.annotations),
    source: { kind: 'mcp', tool: tool.name },
  }));
}

/** Calls an imported MCP tool; its structured answer, or its text. */
export async function callMcp(
  client: McpTools,
  tool: ImportedTool,
  input: Record<string, unknown>,
): Promise<unknown> {
  if (tool.source.kind !== 'mcp') throw new ToolError('unknown_tool', `${tool.name} is not MCP.`);
  const result = await client
    .callTool({ name: tool.source.tool, arguments: input })
    .catch((error: unknown) => {
      throw new ToolError('unreachable', error instanceof Error ? error.message : String(error));
    });
  const text = (result.content ?? [])
    .map((part) =>
      typeof part === 'object' && part !== null && (part as { type?: string }).type === 'text'
        ? String((part as { text?: unknown }).text ?? '')
        : '',
    )
    .join('\n');
  if (result.isError) throw new ToolError('refused', `${tool.name}: ${text.slice(0, 300)}`);
  return result.structuredContent ?? text;
}

/** Connects to a remote MCP server (Streamable HTTP) with the connection's credential. */
export async function connectMcp(
  url: string,
  options: { token?: string; fetch?: typeof fetch } = {},
): Promise<McpTools & { close(): Promise<void> }> {
  const client = new Client(
    { name: 'kete', version: '1' },
    { versionNegotiation: { mode: 'auto' } },
  );
  await client
    .connect(
      new StreamableHTTPClientTransport(new URL(url), {
        ...(options.token
          ? { requestInit: { headers: { authorization: `Bearer ${options.token}` } } }
          : {}),
        ...(options.fetch ? { fetch: options.fetch } : {}),
      }),
    )
    .catch((error: unknown) => {
      throw new ToolError('unreachable', error instanceof Error ? error.message : String(error));
    });
  return client as unknown as McpTools & { close(): Promise<void> };
}
