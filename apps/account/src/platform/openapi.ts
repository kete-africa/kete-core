import { z } from 'zod';
import {
  disableOfferInput,
  offerInput,
  offerTermsInput,
  trialInput,
} from '../features/admin/inputs';
import { personInput, signInLinkInput } from '../features/apps/inputs';
import { makeReadyInput } from '../features/deployments/inputs';

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
const personToken = [{ personToken: [] }];

export const accountSecuritySchemes = {
  appToken: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'A `client_credentials` access token of a trusted Kete app, carrying the `kete:people` scope (spec 013).',
  },
  personToken: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      "A person's access token this Compte Kete issued for the Kete apps (`urn:kete:apps`), with her organization (spec 115).",
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
  '/api/apps/mandates': {
    post: {
      tags: ['Apps'],
      summary: "Exchange a person's token for an agent's mandate",
      description:
        "Only the center's client (scope kete:mandate). The mandate carries the person's same claims and an act claim naming the agent; ten minutes at most, never beyond the person's token (RFC 8693).",
      security: appToken,
      requestBody: {
        required: true,
        ...json(
          {
            type: 'object',
            properties: {
              subjectToken: { type: 'string' },
              agent: {
                type: 'object',
                properties: { id: { type: 'string' }, name: { type: 'string' } },
                required: ['id', 'name'],
              },
            },
            required: ['subjectToken', 'agent'],
          },
          "The person's token and the agent she gives the mandate to",
        ),
      },
      responses: {
        '201': json(
          {
            type: 'object',
            properties: { token: { type: 'string' }, expiresIn: { type: 'integer' } },
            required: ['token', 'expiresIn'],
          },
          'The mandate',
        ),
        '401': error('No valid app token'),
        '403': error('Not the center'),
        '422': error("Invalid input, or a subject that is not a person's token"),
      },
    },
  },
  '/api/apps/standing-mandates': {
    post: {
      tags: ['Apps'],
      summary: 'Give one of the center’s agents a standing mandate',
      description:
        "Only the center's client (scope kete:mandate), with the person's own token as her consent. The agent may then act for her while she is away; given again, it is renewed. She withdraws it in Mon espace Kete.",
      security: appToken,
      requestBody: {
        required: true,
        ...json(
          {
            type: 'object',
            properties: {
              subjectToken: { type: 'string' },
              agent: {
                type: 'object',
                properties: { id: { type: 'string' }, name: { type: 'string' } },
                required: ['id', 'name'],
              },
            },
            required: ['subjectToken', 'agent'],
          },
          "The person's token and the agent she lets act for her",
        ),
      },
      responses: {
        '201': json(
          { type: 'object', properties: { grant: { type: 'string' } }, required: ['grant'] },
          'The standing mandate',
        ),
        '401': error('No valid app token'),
        '403': error('Not the center'),
        '422': error("Invalid input, or a subject that is not a person's token"),
      },
    },
  },
  '/api/apps/standing-mandates/token': {
    post: {
      tags: ['Apps'],
      summary: "An agent's mandate for now, from its standing mandate",
      description:
        "Only the center's client that was given it. The person's claims are read again as they are now; ten minutes. Refused once withdrawn, or once she is no longer a member.",
      security: appToken,
      requestBody: {
        required: true,
        ...json(
          {
            type: 'object',
            properties: {
              organization: { type: 'string' },
              grant: { type: 'string' },
            },
            required: ['organization', 'grant'],
          },
          'The organization and the standing mandate',
        ),
      },
      responses: {
        '201': json(
          {
            type: 'object',
            properties: { token: { type: 'string' }, expiresIn: { type: 'integer' } },
            required: ['token', 'expiresIn'],
          },
          'The mandate',
        ),
        '401': error('No valid app token'),
        '403': error('Not the center, or the person is no longer a member'),
        '404': error('No such standing mandate for this client, or withdrawn'),
        '422': error('Invalid input'),
      },
    },
  },
  '/api/apps/standing-mandates/revoke': {
    post: {
      tags: ['Apps'],
      summary: 'Withdraw a standing mandate',
      description:
        "Only the center's client that was given it: the agent removed, or the person withdrew it there.",
      security: appToken,
      requestBody: {
        required: true,
        ...json(
          {
            type: 'object',
            properties: {
              organization: { type: 'string' },
              grant: { type: 'string' },
            },
            required: ['organization', 'grant'],
          },
          'The organization and the standing mandate',
        ),
      },
      responses: {
        '204': { description: 'Withdrawn, or already withdrawn' },
        '401': error('No valid app token'),
        '403': error('Not the center'),
        '422': error('Invalid input'),
      },
    },
  },
  '/api/apps/clients': {
    post: {
      tags: ['Apps'],
      summary: 'Register an app the factory created',
      description:
        "Only the app factory's client (scope kete:factory). A trusted app (no consent, PKCE), on an https callback of the hosts allowed; its secret is returned once.",
      security: appToken,
      requestBody: {
        required: true,
        ...json(
          {
            type: 'object',
            properties: {
              name: { type: 'string', maxLength: 80 },
              redirectUri: { type: 'string', format: 'uri' },
            },
            required: ['name', 'redirectUri'],
          },
          'The app and its sign-in callback',
        ),
      },
      responses: {
        '201': json(
          {
            type: 'object',
            properties: { clientId: { type: 'string' }, clientSecret: { type: 'string' } },
            required: ['clientId', 'clientSecret'],
          },
          'The registered app, its secret given once',
        ),
        '401': error('No valid app token'),
        '403': error('Not the factory, a host not allowed, or the factory not configured'),
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
  '/api/apps/settings': {
    get: {
      tags: ['Apps'],
      summary: "Her organization's settings and her own preferences",
      description:
        "The Compte Kete's two layers of Kete's settings (spec 115): the organization's generic settings and the person's preferences, which follow her in every app.",
      security: personToken,
      responses: {
        '200': json(
          {
            type: 'object',
            properties: {
              organizationId: {
                type: 'string',
                description: 'The organization these settings belong to: the token’s',
              },
              organization: {
                type: 'object',
                additionalProperties: true,
                description: 'Settings by their key (`kete.locale`…), only those set',
              },
              person: {
                type: 'object',
                additionalProperties: true,
                description: 'Settings by their key (`kete.locale`…), only those set',
              },
            },
            required: ['organizationId', 'organization', 'person'],
          },
          'Both layers',
        ),
        '401': error('No valid token'),
        '403': error('A token without an organization'),
      },
    },
    put: {
      tags: ['Apps'],
      summary: 'Save one of her preferences',
      description:
        "Checked against Kete's declaration of the setting and the person's layer; `null` takes it back to what she inherits. Never by an agent acting for her.",
      security: personToken,
      requestBody: {
        required: true,
        ...json(
          {
            type: 'object',
            properties: { key: { type: 'string' }, value: {} },
            required: ['key', 'value'],
          },
          'The preference',
        ),
      },
      responses: {
        '200': json(
          {
            type: 'object',
            properties: {
              person: {
                type: 'object',
                additionalProperties: true,
                description: 'Settings by their key (`kete.locale`…), only those set',
              },
            },
          },
          'Her preferences now',
        ),
        '401': error('No valid token'),
        '403': error('An agent acting for her, or no organization'),
        '422': error("An unknown setting, a value it does not take, or not a person's setting"),
      },
    },
  },
  '/api/admin/deployments': {
    get: {
      tags: ['Kete Cockpit'],
      summary: "Every organization's deployments, what waits for Kete first",
      description:
        "Kete's fleet (spec 125): each organization's Kete Enterprise — its mode, region, apps, state, address, and another mode asked.",
      security: operatorToken,
      responses: {
        '200': { description: 'The deployments' },
        '401': error('No valid token'),
        '403': error('Not a Kete operator'),
      },
    },
    post: {
      tags: ['Kete Cockpit'],
      summary: 'Say a deployment is made, at its address',
      description:
        'A journaled command in Kete’s organization (@kete/commands): a request becomes ready, a running one moves to the mode its organization asked; the organization hears `deployment.ready`. The same `Idempotency-Key` makes a retry harmless.',
      security: operatorToken,
      parameters: [
        { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        ...json(input(makeReadyInput), 'The deployment and its https address'),
      },
      responses: {
        '200': { description: 'The deployment, made' },
        '400': error('An invalid request'),
        '401': error('No valid token'),
        '403': error('Not a Kete operator'),
        '404': error('No such deployment'),
        '409': error('Nothing left to make'),
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
      summary: "Set or disable an offer, its terms, or an app's trial",
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
              {
                allOf: [
                  input(offerTermsInput),
                  {
                    type: 'object',
                    properties: { action: { const: 'terms' } },
                    required: ['action'],
                  },
                ],
              },
              {
                allOf: [
                  input(trialInput),
                  {
                    type: 'object',
                    properties: { action: { const: 'trial' } },
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
