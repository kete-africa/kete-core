import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { CapabilityRegistry, Caller } from './registry.js';

export interface McpHandlerOptions {
  registry: CapabilityRegistry;
  /** The server's name and version, as MCP clients show them. */
  server: { name: string; version: string };
  /**
   * Who calls: the host checks the request's credentials (for example an OAuth access token of the
   * Compte Kete or of the enterprise's identity) and returns the caller, or null to refuse.
   */
  caller(request: Request): Promise<Caller | null>;
}

/**
 * A stateless MCP endpoint (Streamable HTTP) over a product's capabilities, as a web-standard
 * handler: `(request) => response`. It mounts as is in a TanStack Start server route or in Hono.
 * Each request lists only the tools its caller may use, and invokes them through the registry, so
 * an agent gets exactly the same rules as the screens.
 */
export function createMcpHandler(
  options: McpHandlerOptions,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const caller = await options.caller(request);
    if (!caller) {
      return Response.json(
        { error: 'unauthenticated' },
        { status: 401, headers: { 'www-authenticate': 'Bearer' } },
      );
    }
    const server = new McpServer(options.server);
    for (const tool of await options.registry.tools(caller)) {
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.input },
        async (input: unknown) => {
          const result = await tool.execute(input);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
            structuredContent: result as unknown as Record<string, unknown>,
            isError: result.status === 'refused',
          };
        },
      );
    }
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } finally {
      await server.close();
    }
  };
}
