import { createCapabilityRegistry } from '@kete/capabilities';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  callMcp,
  callOpenApi,
  connectMcp,
  inputOf,
  TOOL_CALL_DRAFT,
  toolCapabilities,
  toolsFromMcp,
  toolsFromOpenApi,
  type ImportedTool,
  type McpTools,
} from '../src/index.js';

// Spec 124: KYA's own tools — its CRM described by OpenAPI, its ticketing served by an MCP server —
// imported as capabilities its agents use under Kete's rules.

const crm = {
  openapi: '3.1.0',
  info: { title: 'CRM', version: '1' },
  paths: {
    '/contacts': {
      get: {
        operationId: 'listContacts',
        summary: 'Les contacts',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'Authorization', in: 'header', schema: { type: 'string' } },
        ],
      },
      post: {
        operationId: 'createContact',
        summary: 'Crée un contact',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Contact' } } },
        },
      },
    },
    '/contacts/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: { summary: 'Un contact' },
      delete: { operationId: 'deleteContact', summary: 'Supprime un contact' },
    },
  },
  components: {
    schemas: {
      Contact: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          company: { $ref: '#/components/schemas/Company' },
        },
      },
      // A cycle: a company lists its contacts.
      Company: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          contacts: { $ref: '#/components/schemas/Contact' },
        },
      },
    },
  },
};

describe('a tool described by OpenAPI', () => {
  const tools = toolsFromOpenApi(crm, { prefix: 'crm' });
  const named = (name: string) => tools.find((t) => t.name === name) as ImportedTool;

  it('imports each operation, named and with its effect', () => {
    expect(tools.map((t) => [t.name, t.effect])).toEqual([
      ['crm_list_contacts', 'read'],
      ['crm_create_contact', 'act'],
      ['crm_get_contacts_id', 'read'],
      ['crm_delete_contact', 'destroy'],
    ]);
    expect(named('crm_list_contacts').inputSchema).toEqual({
      type: 'object',
      properties: { limit: { type: 'integer' } },
    });
    // References resolved, the cycle cut.
    expect(named('crm_create_contact').inputSchema).toMatchObject({
      required: ['body'],
      properties: {
        body: {
          required: ['name'],
          properties: { company: { properties: { contacts: {} } } },
        },
      },
    });
    expect(() => toolsFromOpenApi({ swagger: '2.0' }, { prefix: 'x' })).toThrow(/OpenAPI 3/);
  });

  it('calls an operation with the connection’s credential, never the input’s', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/contacts/c-9')) return new Response('not found', { status: 404 });
      return Response.json({ id: 'c-1' }, { status: 201 });
    }) as unknown as typeof fetch;
    const call = {
      baseUrl: 'https://crm.kya.test/api/',
      credential: { header: 'authorization', value: 'Bearer k' },
      fetch: fake,
    };
    expect(
      await callOpenApi(named('crm_create_contact'), { body: { name: 'Phébé' } }, call),
    ).toEqual({ id: 'c-1' });
    expect(calls[0]?.url).toBe('https://crm.kya.test/api/contacts');
    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ name: 'Phébé' });
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe('Bearer k');
    await callOpenApi(named('crm_list_contacts'), { limit: 5 }, call);
    expect(calls[1]?.url).toBe('https://crm.kya.test/api/contacts?limit=5');
    await expect(
      callOpenApi(named('crm_get_contacts_id'), { id: 'c-9' }, call),
    ).rejects.toMatchObject({ code: 'refused' });
  });
});

describe('a tool served by an MCP server', () => {
  const server: McpTools & { called: unknown[] } = {
    called: [],
    async listTools() {
      return {
        tools: [
          {
            name: 'search_tickets',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
          },
          { name: 'reply', annotations: { readOnlyHint: false, destructiveHint: false } },
          { name: 'close_ticket' },
        ],
      };
    },
    async callTool(request) {
      this.called.push(request);
      if (request.name === 'close_ticket')
        return { isError: true, content: [{ type: 'text', text: 'already closed' }] };
      if (request.name === 'reply') return { content: [{ type: 'text', text: 'sent' }] };
      return { structuredContent: { tickets: [{ id: 'T-1' }] } };
    },
  };

  it('imports its tools: read-only when it says so, destructive unless it says otherwise', async () => {
    const tools = await toolsFromMcp(server, { prefix: 'helpdesk' });
    expect(tools.map((t) => [t.name, t.effect])).toEqual([
      ['helpdesk_search_tickets', 'read'],
      ['helpdesk_reply', 'act'],
      ['helpdesk_close_ticket', 'destroy'],
    ]);
    expect(await callMcp(server, tools[0] as ImportedTool, { q: 'onduleur' })).toEqual({
      tickets: [{ id: 'T-1' }],
    });
    expect(await callMcp(server, tools[1] as ImportedTool, {})).toBe('sent');
    await expect(callMcp(server, tools[2] as ImportedTool, {})).rejects.toMatchObject({
      code: 'refused',
    });
    expect(server.called[0]).toEqual({ name: 'search_tickets', arguments: { q: 'onduleur' } });
  });
});

describe('imported tools as capabilities', () => {
  const tools = toolsFromOpenApi(crm, { prefix: 'crm' });
  const seen: string[] = [];
  const capabilities = toolCapabilities(tools, {
    call: async (tool, input) => {
      seen.push(`${tool.name} ${JSON.stringify(input)}`);
      return { ok: true };
    },
  });

  it('follow Kete’s rules: a read alone, an act as a draft, a destruction confirmed', () => {
    expect(capabilities.map((c) => [c.name, c.autonomy, c.permission])).toEqual([
      ['crm_list_contacts', 1, 'tools:read'],
      ['crm_create_contact', 3, 'tools:act'],
      ['crm_get_contacts_id', 1, 'tools:read'],
      ['crm_delete_contact', 4, 'tools:act'],
    ]);
    const create = capabilities[1];
    expect(create && 'draft' in create && create.draft.recordType).toBe(
      `${TOOL_CALL_DRAFT}.crm_create_contact`,
    );
    expect(create && 'command' in create && create.command.name).toBe('crm-create-contact');
    expect(capabilities.every((c) => c.classification === 'confidential')).toBe(true);
  });

  it('register together: each act and destruction prepares drafts of its own', () => {
    const registry = createCapabilityRegistry(capabilities, {
      authorize: async () => true,
      transaction: async () => {
        throw new Error('not called');
      },
    });
    expect(registry.describeAll().map((c) => c.name)).toHaveLength(4);
  });

  it('check their input, and read through the connection', async () => {
    const read = capabilities[2];
    expect(inputOf(tools[2] as ImportedTool).safeParse({}).success).toBe(false);
    expect(inputOf(tools[2] as ImportedTool).safeParse({ id: 'c-1' }).success).toBe(true);
    if (read?.autonomy !== 1) throw new Error('a read');
    expect(await read.run({ id: 'c-1' }, {} as never)).toEqual({ ok: true });
    expect(seen).toEqual(['crm_get_contacts_id {"id":"c-1"}']);
  });
});

describe('a remote MCP server, over HTTP', () => {
  it('is reached with the connection’s credential, its tools imported and called', async () => {
    const authorization: string[] = [];
    const handler = createMcpHandler(
      () => {
        const server = new McpServer({ name: 'helpdesk', version: '1' });
        server.registerTool(
          'search_tickets',
          {
            description: 'Cherche des tickets.',
            inputSchema: z.object({ q: z.string() }),
            annotations: { readOnlyHint: true },
          },
          async ({ q }) => ({
            content: [{ type: 'text', text: `T-1 ${q}` }],
            structuredContent: { tickets: [{ id: 'T-1', about: q }] },
          }),
        );
        return server;
      },
      { responseMode: 'json' },
    );
    const client = await connectMcp('https://helpdesk.kya.test/mcp', {
      token: 'secret-of-the-connection',
      fetch: (async (url: string | URL | Request, init?: RequestInit) => {
        const request = new Request(url, init);
        authorization.push(request.headers.get('authorization') ?? '');
        return handler.fetch(request);
      }) as typeof fetch,
    });
    const tools = await toolsFromMcp(client, { prefix: 'helpdesk' });
    expect(tools).toMatchObject([
      { name: 'helpdesk_search_tickets', effect: 'read', inputSchema: { required: ['q'] } },
    ]);
    expect(await callMcp(client, tools[0] as ImportedTool, { q: 'onduleur' })).toEqual({
      tickets: [{ id: 'T-1', about: 'onduleur' }],
    });
    expect(new Set(authorization)).toEqual(new Set(['Bearer secret-of-the-connection']));
    await client.close();
  });
});
