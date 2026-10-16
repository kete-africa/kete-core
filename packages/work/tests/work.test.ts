import type { DatedFact } from '@kete/sdk';
import { inOrganization } from '@kete/tenancy';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  awayOn,
  dueNudges,
  finishHolding,
  fluidity,
  forMe,
  getHolding,
  handBack,
  HoldingError,
  holdingEvents,
  openHoldings,
  inWorkingHours,
  reclaimUnheld,
  relayAbsences,
  relayTarget,
  sayHolding,
  workMigrationSql,
  type Structure,
} from '../src/index.js';

// Spec 111: holdings and the relay, on a test schema with its RLS (doctrine D-029).

let db: TestSchema;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(workMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db.drop();
});

let organizations = 0;
/** A fresh organization for each scenario: its holdings are its own. */
const fresh = () => `org_work_${++organizations}_${Date.now()}`;

const kossi = { kind: 'person', id: 'usr_kossi' } as const;
const yao = { kind: 'person', id: 'usr_yao' } as const;
const abla = { kind: 'person', id: 'usr_abla' } as const;

// KYA's structure: Yao stands in for Kossi; Abla manages both and heads the organization.
const structure: Structure = {
  deputyOf: (id) => (id === 'usr_kossi' ? 'usr_yao' : null),
  managerOf: (id) => (id === 'usr_abla' ? null : 'usr_abla'),
  head: 'usr_abla',
};

const said = (ref: string, extra: Record<string, unknown> = {}) => ({
  source: { app: 'enterprise', kind: 'request', ref },
  object: { kind: 'project', id: 'prj_colombe' },
  what: `Chiffrer le devis ${ref}`,
  holder: kossi,
  state: 'held',
  ...extra,
});

const absence = (person: string, day: string, until?: string): DatedFact => ({
  key: `abs_${person}_${day}`,
  kind: 'absence',
  label: 'Absent',
  day,
  ...(until ? { until } : {}),
  person_ids: [person],
});

describe('a holding', () => {
  it('is refused without a holder, at the edge', async () => {
    const org = fresh();
    await inOrganization(db.app, org, async (tx) => {
      const without: Record<string, unknown> = { ...said('Q-1') };
      delete without.holder;
      await expect(sayHolding(tx, org, without)).rejects.toMatchObject({ code: 'holder_required' });
      await expect(
        sayHolding(tx, org, { ...said('Q-1'), holder: { kind: 'person', id: '' } }),
      ).rejects.toBeInstanceOf(HoldingError);
      await expect(sayHolding(tx, org, { ...said('Q-1'), state: 'stuck' })).rejects.toMatchObject({
        code: 'invalid_holding',
      });
    });
  });

  it('is said again under its source, and each change is journaled', async () => {
    const org = fresh();
    await inOrganization(db.app, org, async (tx) => {
      const t0 = new Date('2026-10-19T09:00:00Z');
      const first = await sayHolding(tx, org, said('Q-2'), t0);
      const waiting = await sayHolding(
        tx,
        org,
        said('Q-2', { state: 'waiting', waiting_on: { kind: 'party', id: 'pty_garage_be' } }),
        new Date('2026-10-19T10:00:00Z'),
      );
      expect(waiting.holdingId).toBe(first.holdingId);
      expect(waiting).toMatchObject({ state: 'waiting', waitingOn: { kind: 'party' } });
      expect(waiting.waitingSince?.toISOString()).toBe('2026-10-19T10:00:00.000Z');
      // Said again unchanged, the wait keeps its start.
      const again = await sayHolding(
        tx,
        org,
        said('Q-2', { state: 'waiting', waiting_on: { kind: 'party', id: 'pty_garage_be' } }),
        new Date('2026-10-19T12:00:00Z'),
      );
      expect(again.waitingSince?.toISOString()).toBe('2026-10-19T10:00:00.000Z');
      await sayHolding(tx, org, said('Q-2', { state: 'done' }), new Date('2026-10-20T08:00:00Z'));
      const events = await holdingEvents(tx, first.holdingId);
      expect(events.map((e) => e.type)).toEqual([
        'holding.created',
        'holding.waiting',
        'holding.done',
      ]);
      expect(await getHolding(tx, first.holdingId)).toMatchObject({ state: 'done' });
    });
  });
});

describe('open holdings', () => {
  it('are listed by app, and one whose item finished is closed once', async () => {
    const org = fresh();
    await inOrganization(db.app, org, async (tx) => {
      const mine = await sayHolding(tx, org, said('Q-20'));
      await sayHolding(tx, org, {
        ...said('Q-21'),
        source: { app: 'finance', kind: 'invoice', ref: 'F-1' },
      });
      expect((await openHoldings(tx, { app: 'enterprise' })).map((h) => h.source.ref)).toEqual([
        'Q-20',
      ]);
      expect(await openHoldings(tx)).toHaveLength(2);
      expect(await finishHolding(tx, org, mine.holdingId)).toMatchObject({ state: 'done' });
      expect(await finishHolding(tx, org, mine.holdingId)).toBeNull();
      expect((await holdingEvents(tx, mine.holdingId)).map((e) => e.type)).toEqual([
        'holding.created',
        'holding.done',
      ]);
    });
  });
});

describe('the relay on absence', () => {
  it('« Kossi sera absent vendredi »: his holdings move the same day, deputy first', async () => {
    const org = fresh();
    const friday = new Date('2026-10-23T07:00:00Z');
    await inOrganization(db.app, org, async (tx) => {
      const dueFriday = await sayHolding(tx, org, said('Q-3', { due: '2026-10-23' }));
      const undated = await sayHolding(tx, org, said('Q-4'));
      const nextWeek = await sayHolding(tx, org, said('Q-5', { due: '2026-10-28' }));
      const told = await sayHolding(tx, org, said('Q-6', { for: 'information' }));

      // Thursday: nothing moves yet.
      const thursday = await relayAbsences(tx, org, {
        absences: [absence('usr_kossi', '2026-10-23')],
        structure,
        now: new Date('2026-10-22T07:00:00Z'),
      });
      expect(thursday.moved).toHaveLength(0);

      const { moved, stuck } = await relayAbsences(tx, org, {
        absences: [absence('usr_kossi', '2026-10-23')],
        structure,
        now: friday,
      });
      expect(stuck).toHaveLength(0);
      expect(moved.map((m) => m.holding.holdingId).sort()).toEqual(
        [dueFriday.holdingId, undated.holdingId].sort(),
      );
      expect(moved.every((m) => m.to.id === 'usr_yao' && m.because === 'absence')).toBe(true);
      expect(await getHolding(tx, nextWeek.holdingId)).toMatchObject({ holder: kossi });
      expect(await getHolding(tx, told.holdingId)).toMatchObject({ holder: kossi });
      expect(await getHolding(tx, dueFriday.holdingId)).toMatchObject({
        holder: yao,
        takenOverFrom: kossi,
      });

      // Yao says it is not his: it goes back to Kossi, with his reason.
      const back = await handBack(
        tx,
        org,
        {
          holdingId: undated.holdingId,
          by: yao,
          reason: 'Kossi l’a déjà envoyé jeudi.',
        },
        new Date('2026-10-23T08:00:00Z'),
      );
      expect(back).toMatchObject({ holder: kossi, takenOverFrom: null });
      await expect(
        handBack(tx, org, { holdingId: nextWeek.holdingId, by: yao, reason: 'x' }),
      ).rejects.toMatchObject({ code: 'not_taken_over' });
      const events = (await holdingEvents(tx, undated.holdingId)).map((e) => e.type);
      expect(events).toEqual(['holding.created', 'holding.taken_over', 'holding.handed_back']);
    });
  });

  it('passes to the manager when the deputy is away too, and says what nobody can take', async () => {
    const org = fresh();
    await inOrganization(db.app, org, async (tx) => {
      await sayHolding(tx, org, said('Q-7'));
      const both = await relayAbsences(tx, org, {
        absences: [
          absence('usr_kossi', '2026-10-23'),
          absence('usr_yao', '2026-10-21', '2026-10-24'),
        ],
        structure,
        now: new Date('2026-10-23T07:00:00Z'),
      });
      expect(both.moved[0]?.to).toEqual(abla);

      await sayHolding(tx, org, { ...said('Q-8'), holder: abla });
      const nobody = await relayAbsences(tx, org, {
        absences: [absence('usr_abla', '2026-10-23')],
        structure,
        now: new Date('2026-10-23T07:00:00Z'),
      });
      expect(nobody.stuck.map((h) => h.source.ref)).toEqual(['Q-7', 'Q-8']);
    });
  });
});

describe('never nobody', () => {
  it('gives the holdings of a person who left to her manager, an agent’s to its person', async () => {
    const org = fresh();
    await inOrganization(db.app, org, async (tx) => {
      await sayHolding(tx, org, said('Q-9'));
      await sayHolding(tx, org, { ...said('Q-10'), holder: { kind: 'agent', id: 'agt_relances' } });
      const { moved, stuck } = await reclaimUnheld(tx, org, {
        isActive: (h) => h.id !== 'usr_kossi' && h.id !== 'agt_relances',
        personOfAgent: () => 'usr_yao',
        structure,
      });
      expect(stuck).toHaveLength(0);
      expect(moved.map((m) => [m.holding.source.ref, m.to.id, m.because])).toEqual([
        ['Q-9', 'usr_abla', 'holder_gone'],
        ['Q-10', 'usr_yao', 'holder_gone'],
      ]);
    });
  });
});

describe('the relay on age', () => {
  it('nudges in working hours only, once a day, a party after two days', async () => {
    const org = fresh();
    const monday = new Date('2026-10-19T09:00:00Z');
    const nudger = { kind: 'agent', id: 'agt_relances' } as const;
    await inOrganization(db.app, org, async (tx) => {
      await sayHolding(
        tx,
        org,
        said('Q-11', { state: 'waiting', waiting_on: { kind: 'party', id: 'pty_garage_be' } }),
        monday,
      );
      await sayHolding(
        tx,
        org,
        said('Q-12', { state: 'waiting', waiting_on: { kind: 'person', id: 'usr_abla' } }),
        monday,
      );
      // Tuesday 10:00: Abla is nudged (a day), the client not yet (two days).
      const tuesday = await dueNudges(tx, org, { now: new Date('2026-10-20T10:00:00Z'), nudger });
      expect(tuesday.map((n) => [n.holding.source.ref, n.to.id, n.through])).toEqual([
        ['Q-12', 'usr_abla', null],
      ]);
      // Wednesday 22:00: night, nothing.
      expect(await dueNudges(tx, org, { now: new Date('2026-10-21T22:00:00Z'), nudger })).toEqual(
        [],
      );
      // Thursday 09:00: the client, through the agent in charge; Abla again, a day later.
      const thursday = await dueNudges(tx, org, { now: new Date('2026-10-22T09:00:00Z'), nudger });
      expect(thursday.map((n) => [n.holding.source.ref, n.through?.id ?? null])).toEqual([
        ['Q-11', 'agt_relances'],
        ['Q-12', null],
      ]);
      // An hour later: already nudged today.
      expect(await dueNudges(tx, org, { now: new Date('2026-10-22T10:00:00Z'), nudger })).toEqual(
        [],
      );
    });
  });
});

describe('« Pour moi » and the figures', () => {
  it('gathers holdings from two sources, by urgency, and counts the long waits', async () => {
    const org = fresh();
    const now = new Date('2026-10-23T09:00:00Z');
    await inOrganization(db.app, org, async (tx) => {
      // From Kete Enterprise: a request Abla holds, due today.
      await sayHolding(tx, org, { ...said('R-1', { due: '2026-10-23' }), holder: abla });
      // From Kete Finance: a circuit step Kossi holds, waiting on Abla's answer for three days.
      await sayHolding(
        tx,
        org,
        {
          ...said('C-1'),
          source: { app: 'finance', kind: 'circuit_step', ref: 'DA-2026-0003' },
          state: 'waiting',
          waiting_on: { kind: 'person', id: 'usr_abla' },
        },
        new Date('2026-10-20T09:00:00Z'),
      );
      // Abla holds an older request without a due day, and is told of another.
      await sayHolding(tx, org, { ...said('R-2'), holder: abla }, new Date('2026-10-01T09:00:00Z'));
      await sayHolding(tx, org, { ...said('R-3', { for: 'information' }), holder: abla });

      const mine = await forMe(tx, 'usr_abla');
      expect(mine.toAnswer.map((h) => h.source.ref)).toEqual(['DA-2026-0003']);
      expect(mine.held.map((h) => h.source.ref)).toEqual(['R-1', 'R-2']);
      expect(mine.information.map((h) => h.source.ref)).toEqual(['R-3']);

      const figures = await fluidity(tx, now);
      expect(figures).toMatchObject({ open: 4, waiting: 1 });
      expect(figures.oldestWait).toMatchObject({ hours: 72 });
      expect(figures.over48h).toEqual([
        { waitingOn: { kind: 'person', id: 'usr_abla' }, count: 1, oldestHours: 72 },
      ]);
    });
  });
});

describe('pure pieces', () => {
  it('reads absences, working hours and who stands in', () => {
    const absences = [absence('usr_kossi', '2026-10-23', '2026-10-24')];
    expect(awayOn(absences, 'usr_kossi', '2026-10-24')).toBe(true);
    expect(awayOn(absences, 'usr_kossi', '2026-10-25')).toBe(false);
    expect(awayOn(absences, 'usr_yao', '2026-10-23')).toBe(false);
    const hours = { days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' };
    expect(inWorkingHours(new Date('2026-10-23T08:00:00Z'), hours)).toBe(true);
    expect(inWorkingHours(new Date('2026-10-23T18:00:00Z'), hours)).toBe(false);
    expect(inWorkingHours(new Date('2026-10-24T10:00:00Z'), hours)).toBe(false);
    // Dakar is UTC, Douala is UTC+1: 17:30 UTC is 18:30 in Douala.
    expect(inWorkingHours(new Date('2026-10-23T17:30:00Z'), hours, 60)).toBe(false);
    expect(relayTarget('usr_kossi', structure, () => false)).toBe('usr_yao');
    expect(relayTarget('usr_kossi', structure, (id) => id === 'usr_yao')).toBe('usr_abla');
    expect(relayTarget('usr_abla', structure, () => false)).toBe(null);
  });
});

describe('isolation', () => {
  it('keeps each organization to its own holdings', async () => {
    await assertOrganizationIsolation({
      app: db.app,
      table: 'kete_holdings',
      organizations: ['org_iso_a', 'org_iso_b'],
      insert: async (client, organization) => {
        await sayHolding(client, organization, said(`ISO-${organization}`));
      },
    });
  });
});
