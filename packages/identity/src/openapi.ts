import { openAPI } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/pg-proxy';
import { createIdentity } from './identity.js';
import * as schema from './schema.js';

const unused = async (): Promise<never> => {
  throw new Error('The description of the identity sends nothing.');
};

/** A database with no rows, which keeps nothing. */
const empty = async () => ({ rows: [] });

/**
 * The OpenAPI 3.1 description of the identity's endpoints (people, organizations, passkeys, second
 * factor, OpenID provider), as Better Auth serves them under `/api/auth`. Built from an identity
 * whose database is always empty and which sends nothing: only its endpoints matter.
 */
export async function identityOpenApi(options: {
  baseURL: string;
  scopes?: string[];
}): Promise<Record<string, unknown>> {
  const { auth } = createIdentity({
    appName: 'Kete',
    baseURL: options.baseURL,
    secret: 'the-description-signs-nothing-0000000000',
    db: drizzle(empty, { schema }),
    schema,
    generateId: (model) => model,
    passkeyName: 'Kete',
    emails: { passwordReset: unused, passwordResetUnavailable: unused, invitation: unused },
    pages: { signIn: '/', consent: '/', home: '/', invitation: (id) => `/${id}` },
    appsOf: unused,
    isOperator: unused,
    signInLinks: { expiresIn: 600, deliver: unused },
    ...(options.scopes ? { scopes: options.scopes } : {}),
    plugins: [openAPI({ disableDefaultReference: true })],
  });
  const api = auth.api as unknown as { generateOpenAPISchema(): Promise<Record<string, unknown>> };
  return api.generateOpenAPISchema();
}
