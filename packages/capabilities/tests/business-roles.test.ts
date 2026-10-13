import { inOrganization, type SqlExecutor } from '@kete/tenancy';
import { createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assignBusinessRole,
  businessRoleDecisions,
  businessRoleOf,
  businessRolesMigrationSql,
  createRights,
  decideBusinessPermission,
  definePermissions,
  performGesture,
  permissionsOfBusinessRole,
  RuleError,
  type CapabilityRegistry,
  type Grants,
} from '../src/index.js';

// Spec 093: an app sold alone has the roles of its own trade; the owner decides what each may do;
// a broken rule comes back to the screen as its code.

const words = (text: string) => ({ fr: text, en: text });
const permissions = definePermissions([
  {
    name: 'till:open',
    label: words('Open the till'),
    roles: ['owner', 'admin'],
    businessRoles: ['cashier'],
  },
  {
    name: 'deposits:create',
    label: words('Take a deposit'),
    roles: ['owner', 'admin'],
    businessRoles: ['cashier', 'washer'],
  },
  { name: 'prices:set', label: words('Set prices'), roles: ['owner'] },
]);

let db: TestSchema;
const as = <T>(organizationId: string, work: (client: SqlExecutor) => Promise<T>) =>
  inOrganization(db.app, organizationId, work);

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(businessRolesMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db?.drop();
});

const rightsFor = (organizationId: string, grants?: Grants | null) =>
  createRights({
    permissions,
    ...(grants !== undefined ? { grants: () => Promise.resolve(grants) } : {}),
    businessRoleOf: (person) =>
      as(organizationId, async (client) => ({
        role: await businessRoleOf(client, person.userId),
        decided: await businessRoleDecisions(client),
      })),
  });

describe('business roles', () => {
  it('give a member what her role holds by default, and nothing without one', async () => {
    await as('org_bleu', (client) => assignBusinessRole(client, 'org_bleu', 'usr_essi', 'cashier'));
    const rights = rightsFor('org_bleu');
    expect(
      [...(await rights.permissionsOf({ userId: 'usr_essi', role: 'member' }))].sort(),
    ).toEqual(['deposits:create', 'till:open']);
    expect(await rights.permissionsOf({ userId: 'usr_new', role: 'member' })).toEqual(new Set());
    // Owners and administrators keep the defaults of their Compte Kete role.
    expect(await rights.permissionsOf({ userId: 'usr_boss', role: 'owner' })).toEqual(
      new Set(['till:open', 'deposits:create', 'prices:set']),
    );
  });

  it('follow what the owner ticked or unticked, in his organization only', async () => {
    await as('org_bleu', (client) =>
      decideBusinessPermission(client, 'org_bleu', {
        role: 'cashier',
        permission: 'till:open',
        granted: false,
      }),
    );
    await as('org_bleu', (client) =>
      decideBusinessPermission(client, 'org_bleu', {
        role: 'cashier',
        permission: 'prices:set',
        granted: true,
      }),
    );
    expect(
      [
        ...(await rightsFor('org_bleu').permissionsOf({ userId: 'usr_essi', role: 'member' })),
      ].sort(),
    ).toEqual(['deposits:create', 'prices:set']);
    // Another organization: no role for her there, no decision.
    expect(
      await rightsFor('org_vert').permissionsOf({ userId: 'usr_essi', role: 'member' }),
    ).toEqual(new Set());
    await expect(
      as('org_bleu', (client) =>
        decideBusinessPermission(client, 'org_bleu', {
          role: 'owner',
          permission: 'till:open',
          granted: false,
        }),
      ),
    ).rejects.toThrow(/always/);
  });

  it('give way to a center that manages the app', async () => {
    const managed: Grants = {
      managed: true,
      permissions: [{ permission: 'till:open', everywhere: true, units: [] }],
    };
    expect(
      await rightsFor('org_bleu', managed).permissionsOf(
        { userId: 'usr_essi', role: 'member' },
        'tok',
      ),
    ).toEqual(new Set(['till:open']));
  });

  it('are a pure rule too: the owner role cannot be locked out', () => {
    expect(
      permissionsOfBusinessRole(
        'owner',
        permissions,
        new Map([['owner', new Map([['prices:set', false]])]]),
      ),
    ).toEqual(new Set(['till:open', 'deposits:create', 'prices:set']));
    expect(permissionsOfBusinessRole(null, permissions, new Map())).toEqual(new Set());
  });
});

describe('a gesture on a screen', () => {
  const caller = {
    organizationId: 'org_bleu',
    actor: { kind: 'person' as const, id: 'usr_essi', channel: 'web' as const },
  };
  const registry = (invoke: CapabilityRegistry['invoke']) => ({ invoke });

  it('gives its output, or the code of the rule it broke, with its facts', async () => {
    expect(
      await performGesture(
        registry(() => Promise.resolve({ status: 'done', output: { number: 'A-0412' } })),
        {
          ...caller,
          name: 'deposits_create',
          input: {},
        },
      ),
    ).toEqual({ ok: true, output: { number: 'A-0412' } });
    expect(
      await performGesture(
        registry(() => Promise.reject(new RuleError('till_closed', { till: 'Caisse 1' }))),
        { ...caller, name: 'deposits_create', input: {} },
      ),
    ).toEqual({ ok: false, code: 'till_closed', facts: { till: 'Caisse 1' } });
    expect(
      await performGesture(
        registry(() => Promise.resolve({ status: 'refused', reason: 'not_allowed' })),
        {
          ...caller,
          name: 'prices_set',
          input: {},
        },
      ),
    ).toEqual({ ok: false, code: 'not_allowed', facts: {} });
  });

  it('confirms by default, as the screen asked, and throws what is a fault', async () => {
    let confirmed: boolean | undefined;
    await performGesture(
      registry((invocation) => {
        confirmed = invocation.confirmed;
        return Promise.resolve({ status: 'done', output: null });
      }),
      { ...caller, name: 'x', input: {} },
    );
    expect(confirmed).toBe(true);
    await expect(
      performGesture(
        registry(() => Promise.reject(new Error('database down'))),
        { ...caller, name: 'x', input: {} },
      ),
    ).rejects.toThrow('database down');
  });
});
