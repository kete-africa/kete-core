import { newId } from '@kete/records';
import { validateRouting, type Routing } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { openThread, postMessage, threadAt, threadOf, type Holder } from '@kete/threads';
import { finishHolding, sayHolding } from '@kete/work';
import type { Received } from './received.js';

// The router (spec 113, FR-005; doctrine D-056): each thing received is tied to its object's
// thread, with a holder — never guessed. Rules first: a thread's own address, a known sender, a
// known mail domain. Then the model's reading, above a threshold. Under it, a card « à classer »
// for a person; the card she settles becomes a rule. Received twice, routed once.

const words = {
  fr: { toClassify: (excerpt: string) => `À classer : ${excerpt}` },
  en: { toClassify: (excerpt: string) => `To classify: ${excerpt}` },
} as const;

export type ObjectRef = { kind: string; id: string };

/** What the model reads in it: an intent, the object if it knows it, how sure it is. */
export interface Reading {
  intent: string;
  object?: ObjectRef;
  confidence: number;
}

export interface RouterOptions {
  /** Who settles what nobody could place: the card « à classer » is hers. */
  triage: Holder;
  /**
   * The product's own contacts, after the learned rules: a client known by her number or address,
   * with the object she belongs to (her open project). A rule too: sure, never a guess.
   */
  known?: (received: Received) => Promise<{ object: ObjectRef; intent: string } | null>;
  /** The model's reading (`@kete/ai` behind the product); none: rules, then a person. */
  read?: (received: Received) => Promise<Reading | null>;
  /** Under it, a person decides (default 0.8). */
  threshold?: number;
  /**
   * An intent sure enough with no object yet (a new client's quote request): the product may make
   * its object — a project, a client — and say it; null leaves it to a person.
   */
  objectFor?: (received: Received, reading: Reading) => Promise<ObjectRef | null>;
  /** The thread born for an object: its title and holder (default: its kind and id, the triage). */
  threadFor?: (object: ObjectRef) => Promise<{ title: string; holder: Holder }>;
  locale?: 'fr' | 'en';
}

export class RouterError extends Error {
  constructor(
    readonly code: 'not_found' | 'invalid_routing',
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
    this.name = 'RouterError';
  }
}

/** What is kept of what was received: everything but the files' bytes, kept by the product. */
const kept = (received: Received) => ({
  ...received,
  attachments: received.attachments.map(({ content, ...file }) => {
    void content;
    return file;
  }),
});

interface RoutingRow extends Record<string, unknown> {
  via: Received['via'];
  ref: string;
  received: Received;
  object_kind: string | null;
  object_id: string | null;
  thread_id: string | null;
  holding_id: string | null;
  intent: string;
  confidence: string;
  by: Routing['by'];
  asked: string | null;
}

const toRouting = (row: RoutingRow): Routing => ({
  received: { via: row.via, ref: row.ref },
  ...(row.object_kind && row.object_id
    ? { object: { kind: row.object_kind, id: row.object_id } }
    : {}),
  ...(row.thread_id ? { thread: row.thread_id } : {}),
  ...(row.holding_id ? { holding: row.holding_id } : {}),
  intent: row.intent,
  confidence: Number(row.confidence),
  by: row.by,
  ...(row.asked ? { asked: row.asked } : {}),
});

async function latest(db: SqlExecutor, via: string, ref: string): Promise<RoutingRow | null> {
  const { rows } = await db.query<RoutingRow>(
    `select via, ref, received, object_kind, object_id, thread_id, holding_id, intent, confidence,
            by, asked
       from kete_routings where via = $1 and ref = $2 order by at desc, routing_id desc limit 1`,
    [via, ref],
  );
  return rows[0] ?? null;
}

async function journal(
  db: SqlExecutor,
  organizationId: string,
  received: Received,
  routing: Routing,
  now: Date,
): Promise<Routing> {
  const checked = validateRouting(routing);
  if (!checked.ok) {
    throw new RouterError(
      'invalid_routing',
      'The routing does not fit routing.v1.',
      checked.errors,
    );
  }
  await db.query(
    `insert into kete_routings (routing_id, organization_id, via, ref, received, object_kind,
       object_id, thread_id, holding_id, intent, confidence, by, asked, at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      newId('rtg'),
      organizationId,
      received.via,
      received.ref,
      JSON.stringify(kept(received)),
      routing.object?.kind ?? null,
      routing.object?.id ?? null,
      routing.thread ?? null,
      routing.holding ?? null,
      routing.intent,
      routing.confidence,
      routing.by,
      routing.asked ?? null,
      now,
    ],
  );
  return routing;
}

/** The rule that knows a sender: her own key first, then her mail's domain; the newest wins. */
async function ruleFor(db: SqlExecutor, received: Received) {
  const domain = received.from.address?.split('@')[1];
  const { rows } = await db.query<{ object_kind: string; object_id: string; intent: string }>(
    `select object_kind, object_id, intent from kete_routing_rules
      where match = $1 or match = $2
      order by (match = $1) desc, created_at desc, rule_id desc limit 1`,
    [received.from.key, domain ? `domain:${domain}` : ''],
  );
  const rule = rows[0];
  return rule
    ? { object: { kind: rule.object_kind, id: rule.object_id }, intent: rule.intent }
    : null;
}

/** Says it in its object's thread — born if need be — as a message for action from its sender. */
async function place(
  db: SqlExecutor,
  organizationId: string,
  received: Received,
  object: ObjectRef,
  options: RouterOptions,
  now: Date,
): Promise<{ thread: string; holding: string | null }> {
  let thread = await threadOf(db, object);
  if (!thread) {
    const born = options.threadFor
      ? await options.threadFor(object)
      : { title: received.subject ?? `${object.kind} ${object.id}`, holder: options.triage };
    thread = await openThread(db, organizationId, { kind: 'object', object, ...born }, now);
  }
  const text =
    received.via === 'mail' && received.subject
      ? `${received.subject}\n\n${received.text}`
      : received.text;
  const posted = await postMessage(
    db,
    organizationId,
    {
      thread: thread.id,
      author: { kind: 'contact', id: received.from.key },
      text: text.slice(0, 20000),
      for: 'action',
      via: received.via,
    },
    now,
  );
  return { thread: thread.id, holding: posted.holdingId };
}

/** Routes something received: once; by a rule, by the model, or to a person (FR-005). */
export async function route(
  db: SqlExecutor,
  organizationId: string,
  received: Received,
  options: RouterOptions,
  now = new Date(),
): Promise<Routing> {
  const before = await latest(db, received.via, received.ref);
  if (before) return toRouting(before);
  const base = { received: { via: received.via, ref: received.ref } };

  // A reply to a thread's own address goes back into it.
  for (const address of received.to) {
    const thread = await threadAt(db, address);
    if (thread?.object && thread.state === 'open') {
      const placed = await place(db, organizationId, received, thread.object, options, now);
      return journal(
        db,
        organizationId,
        received,
        {
          ...base,
          object: thread.object,
          thread: placed.thread,
          ...(placed.holding ? { holding: placed.holding } : {}),
          intent: 'reply',
          confidence: 1,
          by: 'rule',
        },
        now,
      );
    }
  }

  const rule =
    (await ruleFor(db, received)) ?? (options.known ? await options.known(received) : null);
  if (rule) {
    const placed = await place(db, organizationId, received, rule.object, options, now);
    return journal(
      db,
      organizationId,
      received,
      {
        ...base,
        object: rule.object,
        thread: placed.thread,
        ...(placed.holding ? { holding: placed.holding } : {}),
        intent: rule.intent,
        confidence: 1,
        by: 'rule',
      },
      now,
    );
  }

  const reading = options.read ? await options.read(received) : null;
  const sure = reading && reading.confidence >= (options.threshold ?? 0.8);
  const object =
    sure && reading
      ? (reading.object ?? (options.objectFor ? await options.objectFor(received, reading) : null))
      : null;
  if (reading && object) {
    const placed = await place(db, organizationId, received, object, options, now);
    return journal(
      db,
      organizationId,
      received,
      {
        ...base,
        object,
        thread: placed.thread,
        ...(placed.holding ? { holding: placed.holding } : {}),
        intent: reading.intent,
        confidence: reading.confidence,
        by: 'model',
      },
      now,
    );
  }

  // Not sure: a person decides, never a guess.
  const excerpt = (received.subject ?? received.text).trim().slice(0, 200) || received.from.key;
  const card = await sayHolding(
    db,
    organizationId,
    {
      source: { app: 'channels', kind: 'triage', ref: `${received.via}:${received.ref}` },
      object: { kind: 'received', id: `${received.via}:${received.ref}`.slice(0, 200) },
      what: words[options.locale ?? 'fr'].toClassify(excerpt).slice(0, 300),
      holder: options.triage,
      state: 'held',
      for: 'action',
    },
    now,
  );
  return journal(
    db,
    organizationId,
    received,
    {
      ...base,
      intent: reading?.intent ?? 'unknown',
      confidence: reading?.confidence ?? 0,
      by: 'model',
      asked: card.holdingId,
    },
    now,
  );
}

/**
 * A person settles a card « à classer »: what was received goes into its object's thread, the card
 * is done, and — unless she says not — the sender is known from now on: a rule.
 */
export async function settle(
  db: SqlExecutor,
  organizationId: string,
  input: {
    via: Received['via'];
    ref: string;
    object: ObjectRef;
    intent: string;
    by: Holder;
    learn?: boolean;
  },
  options: RouterOptions,
  now = new Date(),
): Promise<Routing> {
  const before = await latest(db, input.via, input.ref);
  if (!before) throw new RouterError('not_found', 'Nothing received under this reference.');
  if (!before.asked) return toRouting(before);
  const received = before.received;
  const placed = await place(db, organizationId, received, input.object, options, now);
  await finishHolding(db, organizationId, before.asked, now);
  if (input.learn ?? true) {
    await db.query(
      `insert into kete_routing_rules (rule_id, organization_id, match, object_kind, object_id,
         intent, learned_from, created_by, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        newId('rtr'),
        organizationId,
        received.from.key,
        input.object.kind,
        input.object.id,
        input.intent,
        `${input.via}:${input.ref}`,
        input.by.id,
        now,
      ],
    );
  }
  return journal(
    db,
    organizationId,
    received,
    {
      received: { via: input.via, ref: input.ref },
      object: input.object,
      thread: placed.thread,
      ...(placed.holding ? { holding: placed.holding } : {}),
      intent: input.intent,
      confidence: 1,
      by: 'person',
    },
    now,
  );
}

/** A rule an administrator writes: a sender, or a mail domain (`domain:kya.tg`), to its object. */
export async function addRoutingRule(
  db: SqlExecutor,
  organizationId: string,
  input: { match: string; object: ObjectRef; intent: string; by: string },
  now = new Date(),
): Promise<void> {
  await db.query(
    `insert into kete_routing_rules (rule_id, organization_id, match, object_kind, object_id,
       intent, created_by, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      newId('rtr'),
      organizationId,
      input.match.trim().toLowerCase(),
      input.object.kind,
      input.object.id,
      input.intent,
      input.by,
      now,
    ],
  );
}
