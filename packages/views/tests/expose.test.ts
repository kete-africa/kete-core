import { createCapabilityRegistry } from '@kete/capabilities';
import { describe, expect, it } from 'vitest';
import { exposeRecord } from '../src/index.js';

// Spec 045: a record type enters the system in two read capabilities, with no integration code.

interface Ticket {
  id: string;
  title: string;
  minutes: number;
}
const tickets: Ticket[] = [
  { id: 'tkt_1', title: 'Onduleur en défaut', minutes: 180 },
  { id: 'tkt_2', title: 'Imprimante', minutes: 40 },
];

const capabilities = exposeRecord<Ticket>({
  type: 'ticket',
  description: 'the tickets of the support queues',
  permission: 'tickets:read',
  title: () => 'Tickets',
  empty: () => 'Aucun ticket',
  columns: [
    { key: 'title', label: () => 'Objet', value: (t) => t.title },
    { key: 'minutes', label: () => 'Minutes', align: 'end', value: (t) => t.minutes },
  ],
  list: async (_db, query) =>
    tickets.filter((t) => !query.text || t.title.includes(query.text)).slice(0, query.limit),
  get: async (_db, id) => tickets.find((t) => t.id === id) ?? null,
  label: (t) => t.title,
});

const registry = createCapabilityRegistry(capabilities, {
  authorize: async (caller, permission) =>
    caller.actor.id === 'usr_ama' && permission === 'tickets:read',
  transaction: (_org, work) => work({ query: async () => ({ rows: [] }) } as never),
});
const ama = {
  organizationId: 'org_a',
  actor: { kind: 'person' as const, id: 'usr_ama', channel: 'mcp' as const },
};

describe('a record exposed', () => {
  it('becomes a list and a get capability, level 1, under its read permission', () => {
    expect(registry.describeAll()).toMatchObject([
      { name: 'ticket_list', autonomy: 1, permission: 'tickets:read', view: 'ui://kete/table' },
      { name: 'ticket_get', autonomy: 1, permission: 'tickets:read', view: 'ui://kete/detail' },
    ]);
  });

  it('lists as a table a copilot shows, searchable', async () => {
    const found = await registry.invoke({
      ...ama,
      name: 'ticket_list',
      input: { text: 'Onduleur' },
    });
    expect(found).toMatchObject({
      status: 'done',
      output: {
        view: 'table',
        title: 'Tickets',
        columns: [{ key: 'title' }, { key: 'minutes', align: 'end' }],
        rows: [{ title: 'Onduleur en défaut', minutes: 180 }],
      },
    });
  });

  it('gives one record field by field, and refuses whoever may not read', async () => {
    const one = await registry.invoke({ ...ama, name: 'ticket_get', input: { id: 'tkt_2' } });
    expect(one).toMatchObject({
      output: {
        view: 'detail',
        title: 'Imprimante',
        fields: [
          { label: 'Objet', value: 'Imprimante' },
          { label: 'Minutes', value: 40 },
        ],
      },
    });
    const refused = await registry.invoke({
      organizationId: 'org_a',
      actor: { kind: 'person', id: 'usr_kofi', channel: 'mcp' },
      name: 'ticket_list',
      input: {},
    });
    expect(refused).toEqual({ status: 'refused', reason: 'not_allowed' });
  });
});
