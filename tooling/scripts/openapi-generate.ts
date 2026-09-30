/**
 * Generates the Compte Kete's OpenAPI 3.1 description (spec 026, decision 0006): the identity's
 * endpoints (@kete/identity, under /api/auth) and the Compte Kete's own API, merged into
 * docs/generated/account.openapi.json. `--check` regenerates in memory and fails if the committed
 * file differs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { accountPaths, accountSecuritySchemes } from '../../apps/account/src/platform/openapi.js';
import { identityOpenApi } from '../../packages/identity/src/openapi.js';

const root = join(import.meta.dirname, '..', '..');
const output = join(root, 'docs', 'generated', 'account.openapi.json');
const origin = 'https://compte.kete.africa';

type Document = Record<string, unknown> & {
  paths?: Record<string, unknown>;
  components?: Record<string, Record<string, unknown>>;
  tags?: { name: string; description?: string }[];
};

/**
 * Better Auth writes some schemas the OpenAPI 3.0 way (`nullable`, a `json` type): rewritten as
 * OpenAPI 3.1 says.
 */
function toOpenApi31(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toOpenApi31);
  if (!value || typeof value !== 'object') return value;
  const entries = Object.entries(value as Record<string, unknown>);
  const node: Record<string, unknown> = Object.fromEntries(
    entries.map(([key, item]) => [key, toOpenApi31(item)]),
  );
  if (node['type'] === 'json') delete node['type'];
  if (node['nullable'] === true && typeof node['type'] === 'string') {
    node['type'] = [node['type'], 'null'];
  }
  delete node['nullable'];
  return node;
}

const methods = new Set(['get', 'put', 'post', 'delete', 'patch']);

/** Every operation has a summary: the first sentence of its description, or its method and path. */
function summarized(paths: Record<string, unknown>): Record<string, unknown> {
  for (const [path, item] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(item as Record<string, Document>)) {
      if (!methods.has(method) || operation['summary']) continue;
      const description =
        typeof operation['description'] === 'string' ? operation['description'] : '';
      operation['summary'] =
        description.split(/(?<=\.)\s/)[0]?.replace(/\.$/, '') || `${method.toUpperCase()} ${path}`;
    }
  }
  return paths;
}

const identity = toOpenApi31(
  await identityOpenApi({ baseURL: origin, scopes: ['kete:people'] }),
) as Document;

// Better Auth describes its endpoints relative to its base path.
const identityPaths = Object.fromEntries(
  Object.entries(identity.paths ?? {}).map(([path, item]) => [`/api/auth${path}`, item]),
);

const document = {
  openapi: '3.1.0',
  info: {
    title: 'Compte Kete API',
    version: '1.0.0',
    description:
      'One account for every Kete app. `/api/auth` is the identity (@kete/identity, Better Auth): people, organizations, passkeys, second factor, and the OpenID provider every Kete app signs in with. `/api/apps` serves trusted Kete apps, `/api/admin` Kete Cockpit.',
  },
  servers: [{ url: origin, description: 'Production' }],
  tags: [
    ...(identity.tags ?? []),
    { name: 'Apps', description: 'Trusted Kete apps, with their own token (spec 013, 014).' },
    { name: 'Kete Cockpit', description: 'Kete operators only (spec 007).' },
    { name: 'Payments', description: "The payment provider's notifications." },
  ],
  paths: summarized({ ...identityPaths, ...accountPaths }),
  components: {
    ...identity.components,
    securitySchemes: { ...identity.components?.['securitySchemes'], ...accountSecuritySchemes },
  },
};

const text = `${JSON.stringify(document, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const committed = readFileSync(output, 'utf8');
  if (committed !== text) {
    console.error('docs/generated/account.openapi.json is out of date: run pnpm openapi:generate.');
    process.exit(1);
  }
  console.log('The Compte Kete OpenAPI description is up to date.');
} else {
  writeFileSync(output, text);
  console.log(
    `Wrote ${Object.keys(document.paths).length} paths to docs/generated/account.openapi.json.`,
  );
}
