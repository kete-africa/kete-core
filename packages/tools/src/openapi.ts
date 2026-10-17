import {
  toolName,
  ToolError,
  type ImportedTool,
  type OpenApiParameter,
  type ToolEffect,
} from './tool.js';

// A tool described by OpenAPI 3 (spec 124): each operation becomes an imported tool — its
// parameters and its JSON body as one input object, local references resolved — and is called
// over HTTP with the connection's credential, server-side only.

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const METHODS = ['get', 'head', 'post', 'put', 'patch', 'delete'] as const;
const effectOf = (method: string): ToolEffect =>
  method === 'get' || method === 'head' ? 'read' : method === 'delete' ? 'destroy' : 'act';

/** Resolves `#/...` references, never deeper than 20 levels nor around a cycle. */
function resolver(document: Json) {
  const at = (ref: string): unknown =>
    ref
      .replace(/^#\//, '')
      .split('/')
      .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
      .reduce<unknown>((node, part) => (isObject(node) ? node[part] : undefined), document);
  const resolve = (node: unknown, depth = 0, seen: string[] = []): unknown => {
    if (depth > 20) return {};
    if (Array.isArray(node)) return node.map((item) => resolve(item, depth + 1, seen));
    if (!isObject(node)) return node;
    if (typeof node.$ref === 'string') {
      if (!node.$ref.startsWith('#/') || seen.includes(node.$ref)) return {};
      return resolve(at(node.$ref), depth + 1, [...seen, node.$ref]);
    }
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) => [k, resolve(v, depth + 1, seen)]),
    );
  };
  return resolve;
}

/** The operations of an OpenAPI 3 description, as imported tools named `<prefix>_<operation>`. */
export function toolsFromOpenApi(document: unknown, options: { prefix: string }): ImportedTool[] {
  if (
    !isObject(document) ||
    typeof document.openapi !== 'string' ||
    !document.openapi.startsWith('3')
  ) {
    throw new ToolError('invalid_description', 'Not an OpenAPI 3 description.');
  }
  const paths = isObject(document.paths) ? document.paths : {};
  const resolve = resolver(document);
  const taken = new Set<string>();
  const tools: ImportedTool[] = [];
  for (const [path, rawItem] of Object.entries(paths)) {
    const item = resolve(rawItem);
    if (!isObject(item)) continue;
    const shared = Array.isArray(item.parameters) ? item.parameters : [];
    for (const method of METHODS) {
      const operation = item[method];
      if (!isObject(operation)) continue;
      const properties: Json = {};
      const required: string[] = [];
      const parameters: OpenApiParameter[] = [];
      for (const raw of [
        ...shared,
        ...(Array.isArray(operation.parameters) ? operation.parameters : []),
      ]) {
        if (!isObject(raw) || typeof raw.name !== 'string') continue;
        if (raw.in !== 'path' && raw.in !== 'query' && raw.in !== 'header') continue;
        // The credential's header is the connection's, never an input.
        if (raw.in === 'header' && raw.name.toLowerCase() === 'authorization') continue;
        const isRequired = raw.in === 'path' || raw.required === true;
        parameters.push({ name: raw.name, in: raw.in, required: isRequired });
        properties[raw.name] = {
          ...(isObject(raw.schema) ? raw.schema : { type: 'string' }),
          ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
        };
        if (isRequired) required.push(raw.name);
      }
      const content =
        isObject(operation.requestBody) && isObject(operation.requestBody.content)
          ? operation.requestBody.content
          : {};
      const json = isObject(content['application/json']) ? content['application/json'] : null;
      const body = json && isObject(json.schema) ? json.schema : null;
      if (body) {
        properties.body = body;
        if (isObject(operation.requestBody) && operation.requestBody.required === true) {
          required.push('body');
        }
      }
      const said = [operation.summary, operation.description]
        .filter((text): text is string => typeof text === 'string' && text.trim() !== '')
        .join(' — ');
      tools.push({
        name: toolName(
          options.prefix,
          typeof operation.operationId === 'string' ? operation.operationId : `${method}_${path}`,
          taken,
        ),
        description: (said || `${method.toUpperCase()} ${path}`).slice(0, 1000),
        inputSchema: {
          type: 'object',
          properties,
          ...(required.length ? { required } : {}),
        },
        effect: effectOf(method),
        source: { kind: 'openapi', method, path, parameters, body: body !== null },
      });
    }
  }
  return tools;
}

/** What a call to a tool of an OpenAPI description needs: where, and the credential. */
export interface OpenApiCall {
  baseUrl: string;
  /** `Bearer <token>`, `Basic …`, or a key header — from the connection, never from the input. */
  credential?: { header: string; value: string };
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** Calls an operation: path, query and headers filled from the input, its body as JSON. */
export async function callOpenApi(
  tool: ImportedTool,
  input: Record<string, unknown>,
  call: OpenApiCall,
): Promise<unknown> {
  if (tool.source.kind !== 'openapi')
    throw new ToolError('unknown_tool', `${tool.name} is not OpenAPI.`);
  const { method, path, parameters, body } = tool.source;
  let filled = path;
  const query = new URLSearchParams();
  const headers: Record<string, string> = { accept: 'application/json' };
  for (const parameter of parameters) {
    const value = input[parameter.name];
    if (value === undefined || value === null) continue;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (parameter.in === 'path')
      filled = filled.replace(`{${parameter.name}}`, encodeURIComponent(text));
    else if (parameter.in === 'query') query.set(parameter.name, text);
    else headers[parameter.name] = text;
  }
  if (call.credential) headers[call.credential.header] = call.credential.value;
  const url = `${call.baseUrl.replace(/\/$/, '')}${filled}${query.size ? `?${query}` : ''}`;
  const send = body && input.body !== undefined;
  const response = await (call.fetch ?? fetch)(url, {
    method: method.toUpperCase(),
    headers: send ? { ...headers, 'content-type': 'application/json' } : headers,
    ...(send ? { body: JSON.stringify(input.body) } : {}),
    signal: AbortSignal.timeout(call.timeoutMs ?? 20_000),
  }).catch((error: unknown) => {
    throw new ToolError('unreachable', error instanceof Error ? error.message : String(error));
  });
  const text = await response.text();
  let answer: unknown = text;
  try {
    answer = text ? JSON.parse(text) : null;
  } catch {
    // A text answer stays text.
  }
  if (!response.ok) {
    throw new ToolError('refused', `${tool.name}: ${response.status} ${text.slice(0, 300)}`.trim());
  }
  return answer;
}
