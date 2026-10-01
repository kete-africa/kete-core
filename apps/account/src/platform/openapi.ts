import { z } from 'zod';
import { disableOfferInput, offerInput } from '../features/admin/inputs';
import { personInput, signInLinkInput } from '../features/apps/inputs';

// The Compte Kete's own API, beside the identity's (spec 026): what Kete apps and Kete Cockpit
// call. Pure data built from the schemas the routes validate with, so the description cannot drift;
// `pnpm openapi:generate` merges it with the identity's into docs/generated/account.openapi.json.

type Schema = Record<string, unknown>;

const input = (schema: z.ZodType): Schema => z.toJSONSchema(schema, { io: 'input' }) as Schema;

const json = (schema: Schema, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

const error = (description: string) =>
  json(
    { type: 'object', properties: { error: { type: 'string' } }, required: ['error'] },
    description,
  );

const appToken = [{ appToken: [] }];
const operatorToken = [{ operatorToken: [] }];

export const accountSecuritySchemes = {
  appToken: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'A `client_credentials` access token of a trusted Kete app, carrying the `kete:people` scope (spec 013).',
  },
  operatorToken: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'The access token of a Kete operator: owner or admin of Kete, signing in strongly (spec 007).',
  },
};

export const accountPaths: Record<string, Schema> = {
  '/api/apps/people': {
    post: {
      tags: ['Apps'],
      summary: 'Provision a person by the phone number a channel proved',
      description:
        'Returns the person with this number and her first organization, created in silence when new (spec 013).',
      security: appToken,
      requestBody: { required: true, ...json(input(personInput), 'The person') },
      responses: {
        '200': json(
          {
            type: 'object',
            properties: {
              personId: { type: 'string' },
              organizationId: { type: 'string' },
              created: { type: 'boolean' },
            },
            required: ['personId', 'organizationId', 'created'],
          },
          'The person and her organization',
        ),
        '401': error('No valid app token'),
        '403': error('The app may not provision people'),
        '422': error('Invalid input'),
      },
    },
  },
  '/api/apps/sign-in-links': {
    post: {
      tags: ['Apps'],
      summary: 'A one-time sign-in link for a provisioned person',
      description:
        "Valid ten minutes, landing on one of the app's own redirect origins. Never for a person who signs in strongly.",
      security: appToken,
      requestBody: {
        required: true,
        ...json(input(signInLinkInput), 'The person and where to land'),
      },
      responses: {
        '200': json(
          {
            type: 'object',
            properties: {
              url: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
            },
            required: ['url', 'expiresAt'],
          },
          'The link',
        ),
        '401': error('No valid app token'),
        '403': error('Not allowed, or the person signs in with a second factor'),
        '404': error('No person provisioned by phone with this id'),
        '422': error('Invalid input, or a return address outside the app'),
      },
    },
  },
  '/api/apps/continue': {
    get: {
      tags: ['Apps'],
      summary: 'Where a sign-in link lands once it signed the person in',
      description:
        'The session the link opened is the proof; the link must be hers, unused, unexpired.',
      security: [],
      parameters: [{ name: 'link', in: 'query', required: true, schema: { type: 'string' } }],
      responses: {
        '302': { description: "To the app's return address, or to the sign-in page when expired" },
      },
    },
  },
  '/api/apps/access': {
    get: {
      tags: ['Apps'],
      summary: 'Which apps an organization may use, and until when',
      security: appToken,
      parameters: [
        { name: 'organizationId', in: 'query', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': json(
          {
            type: 'object',
            properties: {
              access: {
                type: 'object',
                additionalProperties: { type: 'string', format: 'date-time' },
              },
            },
            required: ['access'],
          },
          'Each app with the end of its access, grace included',
        ),
        '401': error('No valid app token'),
        '403': error('The app may not read access'),
        '422': error('Invalid organization id'),
      },
    },
  },
  '/api/admin/offers': {
    get: {
      tags: ['Kete Cockpit'],
      summary: 'The offers catalog and the products the store sells',
      security: operatorToken,
      responses: {
        '200': { description: 'The provider, its products and the offers' },
        '401': error('No valid token'),
        '403': error('Not a Kete operator'),
      },
    },
    post: {
      tags: ['Kete Cockpit'],
      summary: 'Set or disable an offer',
      description:
        'A journaled command (@kete/commands). The same `Idempotency-Key` makes a retry harmless; the price is read from the provider, never from the caller.',
      security: operatorToken,
      parameters: [
        { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        ...json(
          {
            oneOf: [
              {
                allOf: [
                  input(offerInput),
                  {
                    type: 'object',
                    properties: { action: { const: 'set' } },
                    required: ['action'],
                  },
                ],
              },
              {
                allOf: [
                  input(disableOfferInput),
                  {
                    type: 'object',
                    properties: { action: { const: 'disable' } },
                    required: ['action'],
                  },
                ],
              },
            ],
          },
          'What to do',
        ),
      },
      responses: {
        '200': { description: 'The outcome of the command' },
        '400': error('Invalid request or refused command'),
        '401': error('No valid token'),
        '403': error('Not a Kete operator'),
        '409': error('The same key was used for another request'),
      },
    },
  },
  '/api/payments/notifications': {
    post: {
      tags: ['Payments'],
      summary: "The payment provider's notifications",
      description:
        'The raw body is what is signed. 401 for anything not genuine; 200 once handled, or already handled.',
      security: [],
      responses: {
        '200': json({ type: 'object', properties: { ok: { const: true } } }, 'Handled'),
        '401': { description: 'Not genuine' },
      },
    },
  },
};
