import { describe, expect, it } from 'vitest';
import { createRights, definePermissions, describePermissions } from '../src/index.js';

const permissions = definePermissions([
  {
    name: 'tickets:read',
    label: { fr: 'Lire les tickets', en: 'Read tickets' },
    roles: ['owner', 'admin', 'member'],
  },
  {
    name: 'tickets:manage',
    label: { fr: 'Gérer les files', en: 'Manage queues' },
    description: { fr: 'Files, délais et indicateurs', en: 'Queues, deadlines and indicators' },
    roles: ['owner', 'admin'],
  },
]);

describe('an app’s permissions', () => {
  it('are declared with their words and default roles, as the manifest describes them', () => {
    expect(describePermissions(permissions)[1]).toEqual({
      name: 'tickets:manage',
      label: { fr: 'Gérer les files', en: 'Manage queues' },
      description: { fr: 'Files, délais et indicateurs', en: 'Queues, deadlines and indicators' },
      roles: ['owner', 'admin'],
    });
    expect(() =>
      definePermissions([{ name: 'Tickets', label: { fr: 'x', en: 'x' }, roles: [] }]),
    ).toThrow(/feature:verb/);
    expect(() =>
      definePermissions([{ name: 'a:b', label: { fr: '', en: 'x' }, roles: [] }]),
    ).toThrow(/French and in English/);
  });

  it('keep their defaults without a center, without a token, or while unmanaged', async () => {
    const alone = createRights({ permissions });
    expect([...(await alone.permissionsOf({ userId: 'u1', role: 'member' }))]).toEqual([
      'tickets:read',
    ]);
    expect((await alone.permissionsOf(null)).size).toBe(0);
    const unmanaged = createRights({
      permissions,
      grants: async () => ({ managed: false, permissions: [] }),
    });
    expect([...(await unmanaged.permissionsOf({ userId: 'u1', role: 'admin' }, 'token'))]).toEqual([
      'tickets:read',
      'tickets:manage',
    ]);
    const down = createRights({
      permissions,
      grants: async () => {
        throw new Error('down');
      },
    });
    expect([...(await down.permissionsOf({ userId: 'u1', role: 'member' }, 'token'))]).toEqual([
      'tickets:read',
    ]);
  });

  it('follow the center once it manages them, only for what the app declares', async () => {
    const rights = createRights({
      permissions,
      grants: async () => ({
        managed: true,
        permissions: [
          { permission: 'tickets:manage', everywhere: false, units: ['unt_sav'] },
          { permission: 'billing:pay', everywhere: true, units: [] },
          { permission: 'tickets:read', everywhere: false, units: [] },
        ],
      }),
    });
    expect([...(await rights.permissionsOf({ userId: 'u1', role: 'member' }, 'token'))]).toEqual([
      'tickets:manage',
    ]);
  });

  it('keep the last grants known for a person when the center refuses another token', async () => {
    let answer: 'grants' | 'silent' = 'grants';
    let time = 0;
    const rights = createRights({
      permissions,
      now: () => time,
      grants: async () =>
        answer === 'grants'
          ? {
              managed: true,
              permissions: [{ permission: 'tickets:read', everywhere: true, units: [] }],
            }
          : null,
    });
    const person = { userId: 'u1', role: 'admin' as const };
    expect([...(await rights.permissionsOf(person, 'screen-token'))]).toEqual(['tickets:read']);
    answer = 'silent';
    expect([...(await rights.permissionsOf(person, 'copilot-token'))]).toEqual(['tickets:read']);
    time = 86_401_000;
    expect([...(await rights.permissionsOf(person, 'copilot-token'))]).toEqual([
      'tickets:read',
      'tickets:manage',
    ]);
  });
});
