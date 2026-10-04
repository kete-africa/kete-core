import type { Actor } from '@kete/commands';
import {
  acceptedContent,
  CLIENT_CAPABILITIES_META_KEY,
  createMcpHandler as createSdkHandler,
  inputRequired,
  McpServer,
  type ServerContext,
} from '@modelcontextprotocol/server';
import { z } from 'zod';
import { DRAFT_REVIEW_VIEW, type CapabilityRegistry, type Caller } from './registry.js';

/** The MIME type of an MCP Apps view (doctrine D-037). */
export const VIEW_MIME_TYPE = 'text/html;profile=mcp-app';

/** A view a host shows in the conversation: one HTML document, sandboxed in an iframe. */
export interface ViewResource {
  /** `ui://kete/review`, `ui://nettio/deposit-map`. */
  uri: string;
  name: string;
  description?: string;
  /** The HTML document (MCP Apps: a single, self-contained page). */
  html(): Promise<string>;
  /** The origins it may reach; nothing else is allowed by the host. */
  csp?: { connectDomains?: string[]; resourceDomains?: string[]; frameDomains?: string[] };
  prefersBorder?: boolean;
}

export interface McpHandlerOptions {
  registry: CapabilityRegistry;
  /** The server's name and version, as MCP clients show them. */
  server: { name: string; version: string };
  /**
   * Who calls: the host checks the request's credentials (for example an OAuth access token of the
   * Compte Kete or of the enterprise's identity) and returns the caller, or null to refuse.
   */
  caller(request: Request): Promise<Caller | null>;
  /** The views the product serves; `ui://kete/review` from @kete/views lets people decide drafts. */
  views?: ViewResource[];
  /** The product's own screen for a draft: the link that always works, and where level 4 is decided. */
  draftUrl?(draftId: string): string;
  /**
   * Where MCP clients learn how to get a token (RFC 9728): the address of this server's
   * protected resource metadata (see `protectedResourceMetadata`).
   */
  resourceMetadataUrl?: string;
}

/**
 * In a view or in her client's form, the person decides, not the model: the decision tools are
 * visible to the view only (MCP Apps `visibility: ["app"]`), a form is shown by her client to her,
 * and both run with the person the agent acts for, through the `view` channel. The drafts layer
 * still refuses any actor who is not a person, and level 4 is only decided in the product's own
 * screen.
 */
function personOf(caller: Caller): Caller | null {
  const { actor } = caller;
  const person: Actor | null =
    actor.kind === 'person'
      ? { kind: 'person', id: actor.id, channel: 'view' }
      : actor.onBehalfOf?.kind === 'person'
        ? { kind: 'person', id: actor.onBehalfOf.id, channel: 'view' }
        : null;
  return person ? { actor: person, organizationId: caller.organizationId } : null;
}

/** What the person answers in her MCP client's form (2026-07-28 multi-round-trip elicitation). */
const decisionForm = z.object({
  decision: z.enum(['validate', 'refuse']).describe('Validate the draft, or refuse it'),
  reason: z.string().max(1000).optional().describe('Why, when refusing'),
});

/** Whether the client asking can show a form to its person (it declared form elicitation). */
function asksPerson(ctx: ServerContext): boolean {
  const envelope = ctx.mcpReq.envelope as Record<string, unknown> | undefined;
  const capabilities = envelope?.[CLIENT_CAPABILITIES_META_KEY] as
    { elicitation?: { form?: object } } | undefined;
  const elicitation = capabilities?.elicitation;
  return Boolean(elicitation && (elicitation.form || Object.keys(elicitation).length === 0));
}

const result = (value: object, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  structuredContent: value as Record<string, unknown>,
  isError,
});

/**
 * A stateless MCP endpoint (Streamable HTTP, protocol 2026-07-28 and 2025-era clients) over a
 * product's capabilities, as a web-standard handler: `(request) => response`. It mounts as is in a
 * TanStack Start server route or in Hono. Each request lists only the tools its caller may use,
 * and invokes them through the registry, so an agent gets exactly the same rules as the screens. A
 * tool names its view (MCP Apps), which the host shows with its result; a draft is put to the
 * person in her client's form when it can show one.
 */
export function createMcpHandler(
  options: McpHandlerOptions,
): (request: Request) => Promise<Response> {
  const views = options.views ?? [];
  const served = new Set(views.map((view) => view.uri));
  const openUrl = (draftId: string) =>
    options.draftUrl ? { openUrl: options.draftUrl(draftId) } : {};

  return async (request) => {
    const caller = await options.caller(request);
    if (!caller) {
      const metadata = options.resourceMetadataUrl
        ? `, resource_metadata="${options.resourceMetadataUrl}"`
        : '';
      return Response.json(
        { error: 'unauthenticated' },
        { status: 401, headers: { 'www-authenticate': `Bearer${metadata}` } },
      );
    }
    const tools = await options.registry.tools(caller);
    const person = personOf(caller);

    // One server per request, for this caller only; the SDK serves both protocol eras.
    const handler = createSdkHandler(
      ({ era }) => {
        const server = new McpServer(options.server, {
          capabilities: { tools: {}, resources: {} },
          // Lists vary with the caller's rights: only her client keeps them, a minute at most.
          cacheHints: {
            'tools/list': { ttlMs: 60_000, cacheScope: 'private' },
            'resources/list': { ttlMs: 60_000, cacheScope: 'private' },
            'resources/read': { ttlMs: 3_600_000, cacheScope: 'private' },
          },
        });

        for (const view of views) {
          server.registerResource(
            view.name,
            view.uri,
            {
              mimeType: VIEW_MIME_TYPE,
              ...(view.description ? { description: view.description } : {}),
              _meta: {
                ui: {
                  ...(view.csp ? { csp: view.csp } : {}),
                  ...(view.prefersBorder === undefined
                    ? {}
                    : { prefersBorder: view.prefersBorder }),
                },
              },
            },
            async () => ({
              contents: [{ uri: view.uri, mimeType: VIEW_MIME_TYPE, text: await view.html() }],
            }),
          );
        }

        for (const tool of tools) {
          const view = tool.view && served.has(tool.view) ? tool.view : undefined;
          server.registerTool(
            tool.name,
            {
              description: tool.description,
              inputSchema: tool.input,
              ...(view ? { _meta: { ui: { resourceUri: view } } } : {}),
            },
            async (input: unknown, ctx: ServerContext) => {
              // The retry after the person answered: her decision on the draft of the first round.
              // The state is only a draft's id; deciding checks her rights on it as the screen does.
              const pending = era === 'modern' ? ctx.mcpReq.requestState<string>() : undefined;
              if (typeof pending === 'string' && pending && person) {
                const answer = acceptedContent(ctx.mcpReq.inputResponses, 'decision', decisionForm);
                if (!answer) {
                  return result({
                    status: 'draft',
                    draftId: pending,
                    message: 'The person did not decide; the draft waits for her.',
                    ...openUrl(pending),
                  });
                }
                const decided = await options.registry.decide(
                  answer.decision === 'validate'
                    ? { ...person, draftId: pending, action: 'validate' }
                    : {
                        ...person,
                        draftId: pending,
                        action: 'refuse',
                        reason: answer.reason?.trim() || 'Refused in the MCP client.',
                      },
                );
                return result(
                  { ...decided, ...openUrl(pending) },
                  decided.status === 'not_possible',
                );
              }
              const outcome = await tool.execute(input);
              const extra = outcome.status === 'draft' ? openUrl(outcome.draftId) : {};
              if (
                outcome.status === 'draft' &&
                era === 'modern' &&
                person &&
                tool.autonomy === 3 &&
                asksPerson(ctx)
              ) {
                return inputRequired({
                  inputRequests: {
                    decision: inputRequired.elicit({
                      message: [
                        tool.description,
                        JSON.stringify(outcome.review.values, null, 2),
                        'Validate this draft?',
                      ].join('\n\n'),
                      requestedSchema: decisionForm,
                    }),
                  },
                  requestState: outcome.draftId,
                });
              }
              return result({ ...outcome, ...extra }, outcome.status === 'refused');
            },
          );
        }

        if (served.has(DRAFT_REVIEW_VIEW)) {
          const forView = {
            _meta: { ui: { resourceUri: DRAFT_REVIEW_VIEW, visibility: ['app'] } },
          };
          const draftId = z.string().min(1).max(128);
          const notAPerson = { status: 'not_possible', reason: 'not_a_person' };

          server.registerTool(
            'kete_draft_review',
            {
              description: 'A draft as the review view shows it.',
              inputSchema: z.object({ draftId }),
              ...forView,
            },
            async ({ draftId: id }) => {
              const review = await options.registry.review(caller, id);
              return review
                ? result({ status: 'review', review, ...openUrl(id) })
                : result({ status: 'not_possible', reason: 'not_found' }, true);
            },
          );
          server.registerTool(
            'kete_draft_validate',
            {
              description: 'The person validates the draft, with her corrections.',
              inputSchema: z.object({
                draftId,
                corrections: z.record(z.string(), z.unknown()).optional(),
              }),
              ...forView,
            },
            async ({ draftId: id, corrections }) => {
              if (!person) return result(notAPerson, true);
              const decided = await options.registry.decide({
                ...person,
                draftId: id,
                action: 'validate',
                ...(corrections ? { corrections } : {}),
              });
              return result({ ...decided, ...openUrl(id) }, decided.status === 'not_possible');
            },
          );
          server.registerTool(
            'kete_draft_refuse',
            {
              description: 'The person refuses the draft, with her reason.',
              inputSchema: z.object({ draftId, reason: z.string().min(1).max(1000) }),
              ...forView,
            },
            async ({ draftId: id, reason }) => {
              if (!person) return result(notAPerson, true);
              const decided = await options.registry.decide({
                ...person,
                draftId: id,
                action: 'refuse',
                reason,
              });
              return result(decided, decided.status === 'not_possible');
            },
          );
        }
        return server;
      },
      // Nothing is sent before a result: one JSON answer per request, nothing held after it.
      { responseMode: 'json' },
    );
    try {
      return await handler.fetch(request);
    } finally {
      await handler.close();
    }
  };
}

/**
 * The protected resource metadata of an MCP endpoint (RFC 9728), which MCP clients read to find the
 * identity that issues its tokens — the Compte Kete, or an enterprise's identity.
 */
export function protectedResourceMetadata(metadata: {
  /** The MCP endpoint's address, e.g. https://nettio.kete.africa/mcp */
  resource: string;
  /** The issuers of its tokens, e.g. https://compte.kete.africa */
  authorizationServers: string[];
  scopes?: string[];
}): () => Response {
  const body = {
    resource: metadata.resource,
    authorization_servers: metadata.authorizationServers,
    bearer_methods_supported: ['header'],
    ...(metadata.scopes ? { scopes_supported: metadata.scopes } : {}),
  };
  return () => Response.json(body, { headers: { 'cache-control': 'public, max-age=3600' } });
}
