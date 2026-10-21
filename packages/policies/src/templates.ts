import type { Gesture, Policy } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import type { Entity, PolicyEngine } from './engine.js';
import { currentPolicies } from './store.js';

// The six policies of D-058 in plain forms (spec 139, FR-014): a sentence with its blanks, turned
// into a Cedar rule the product's schema checks when it is saved. They are written for the actions
// Kete's center declares — `contract.sign`, `purchase.commit`, `message.client`, `card.decide`,
// `document.read`, `document.delete` —; a product without one of them refuses that template when
// saving it. And a simulation: what a policy would have decided over the gestures of a period.

export type PolicyFamily = 'commits' | 'speaks' | 'spending' | 'deputies' | 'retention' | 'consent';
export type Approver = 'manager' | 'direction' | 'project.holder' | 'on_behalf_of';
export type Channel = 'whatsapp' | 'mail' | 'telegram' | 'phone';

export interface Blanks {
  amount?: number;
  approver?: Approver;
  channels?: Channel[];
  from?: number;
  to?: number;
  days?: number;
}
type BlankName = keyof Blanks;

export interface PolicyTemplate {
  id: string;
  family: PolicyFamily;
  set: Policy['set'];
  blanks: readonly BlankName[];
  sentence: (values: Required<Blanks>, locale: 'fr' | 'en') => string;
  rule: (values: Required<Blanks>) => string;
  /** Who approves, for an approval: fixed, or the blank `approver`. */
  approver?: Approver;
}

const approvers: Record<Approver, { fr: string; en: string }> = {
  manager: { fr: 'son responsable', en: 'their manager' },
  direction: { fr: 'la direction', en: 'the management' },
  'project.holder': { fr: 'le responsable du projet', en: 'the project’s holder' },
  on_behalf_of: { fr: 'sa personne', en: 'its person' },
};
const channelWords: Record<Channel, { fr: string; en: string }> = {
  whatsapp: { fr: 'WhatsApp', en: 'WhatsApp' },
  mail: { fr: 'mail', en: 'e-mail' },
  telegram: { fr: 'Telegram', en: 'Telegram' },
  phone: { fr: 'téléphone', en: 'phone' },
};
const amountIn = (amount: number, locale: 'fr' | 'en') =>
  `${new Intl.NumberFormat(locale).format(amount).replace(/\u202f|\u00a0/g, ' ')} F`;
const joined = (words: string[], locale: 'fr' | 'en') =>
  words.length < 2
    ? (words[0] ?? '')
    : `${words.slice(0, -1).join(', ')} ${locale === 'fr' ? 'ou' : 'or'} ${words.at(-1)}`;

const Kete = (action: string) => `Kete::Action::"${action}"`;

export const policyTemplates: readonly PolicyTemplate[] = [
  // 1. Who commits the company.
  {
    id: 'commits.signers',
    family: 'commits',
    set: 'authority',
    blanks: [],
    sentence: (_, l) =>
      l === 'fr' ? 'Signe qui a le pouvoir de signature' : 'Who holds the power to sign, signs',
    rule: () =>
      `permit (principal is Kete::Person, action == ${Kete('contract.sign')}, resource)\n  when { principal.signs };`,
  },
  {
    id: 'commits.no-agent',
    family: 'commits',
    set: 'authority',
    blanks: [],
    sentence: (_, l) => (l === 'fr' ? 'Un agent ne signe jamais' : 'An agent never signs'),
    rule: () => `forbid (principal is Kete::Agent, action == ${Kete('contract.sign')}, resource);`,
  },
  {
    id: 'commits.above',
    family: 'commits',
    set: 'approval',
    blanks: ['amount', 'approver'],
    sentence: (v, l) =>
      l === 'fr'
        ? `Au-delà de ${amountIn(v.amount, l)}, ${approvers[v.approver].fr} approuve la signature`
        : `Above ${amountIn(v.amount, l)}, ${approvers[v.approver].en} approves the signature`,
    rule: (v) =>
      `permit (principal, action == ${Kete('contract.sign')}, resource)\n  when { context.amount > ${v.amount} };`,
  },
  // 2. Who speaks for the company.
  {
    id: 'speaks.channels',
    family: 'speaks',
    set: 'authority',
    blanks: ['channels'],
    sentence: (v, l) => {
      const words = joined(
        v.channels.map((c) => channelWords[c][l]),
        l,
      );
      return l === 'fr'
        ? `On écrit aux clients par ${words}`
        : `The company writes to clients by ${words}`;
    },
    rule: (v) =>
      `permit (principal, action == ${Kete('message.client')}, resource)\n  when { ${JSON.stringify(v.channels)}.contains(context.channel) };`,
  },
  {
    id: 'speaks.agent-hours',
    family: 'speaks',
    set: 'authority',
    blanks: ['from', 'to'],
    sentence: (v, l) =>
      l === 'fr'
        ? `Un agent n’écrit pas aux clients avant ${v.from} h ni après ${v.to} h`
        : `An agent does not write to clients before ${v.from}:00 nor after ${v.to}:00`,
    rule: (v) =>
      `forbid (principal is Kete::Agent, action == ${Kete('message.client')}, resource)\n  when { context.hour < ${v.from} || context.hour >= ${v.to} };`,
  },
  {
    id: 'speaks.agent-template',
    family: 'speaks',
    set: 'approval',
    approver: 'on_behalf_of',
    blanks: [],
    sentence: (_, l) =>
      l === 'fr'
        ? 'Un agent qui écrit sans modèle approuvé demande à sa personne'
        : 'An agent writing without an approved template asks its person',
    rule: () =>
      `permit (principal is Kete::Agent, action == ${Kete('message.client')}, resource)\n  unless { context.approvedTemplate };`,
  },
  // 3. Spending limits.
  {
    id: 'spending.people',
    family: 'spending',
    set: 'authority',
    blanks: [],
    sentence: (_, l) =>
      l === 'fr' ? 'Une personne engage un achat' : 'A person commits a purchase',
    rule: () =>
      `permit (principal is Kete::Person, action == ${Kete('purchase.commit')}, resource);`,
  },
  {
    id: 'spending.over-limit',
    family: 'spending',
    set: 'approval',
    approver: 'manager',
    blanks: [],
    sentence: (_, l) =>
      l === 'fr'
        ? 'Au-delà de sa limite, son responsable approuve'
        : 'Beyond their limit, their manager approves',
    rule: () =>
      `permit (principal is Kete::Person, action == ${Kete('purchase.commit')}, resource)\n  when { context.amount > principal.spendingLimit };`,
  },
  {
    id: 'spending.above',
    family: 'spending',
    set: 'approval',
    blanks: ['amount', 'approver'],
    sentence: (v, l) =>
      l === 'fr'
        ? `Au-delà de ${amountIn(v.amount, l)}, ${approvers[v.approver].fr} approuve l’achat`
        : `Above ${amountIn(v.amount, l)}, ${approvers[v.approver].en} approves the purchase`,
    rule: (v) =>
      `permit (principal, action == ${Kete('purchase.commit')}, resource)\n  when { context.amount > ${v.amount} };`,
  },
  {
    id: 'spending.over-budget',
    family: 'spending',
    set: 'approval',
    approver: 'project.holder',
    blanks: [],
    sentence: (_, l) =>
      l === 'fr'
        ? 'Au-delà du budget restant, le responsable du projet approuve'
        : 'Beyond the budget left, the project’s holder approves',
    rule: () =>
      `permit (principal, action == ${Kete('purchase.commit')}, resource)\n  when { context.amount > resource.budgetLeft };`,
  },
  // 4. Deputies.
  {
    id: 'deputies.decide',
    family: 'deputies',
    set: 'authority',
    blanks: [],
    sentence: (_, l) =>
      l === 'fr'
        ? 'Le titulaire décide sa carte ; son suppléant pendant son absence'
        : 'The holder decides their card; their deputy while they are away',
    rule: () =>
      `permit (principal, action == ${Kete('card.decide')}, resource)\n  when { principal == resource.holder ||\n    (context.holderAbsent && resource.holder has deputy && resource.holder.deputy == principal) };`,
  },
  // 5. Retention and confidentiality.
  {
    id: 'retention.keep',
    family: 'retention',
    set: 'authority',
    blanks: ['days'],
    sentence: (v, l) =>
      l === 'fr'
        ? `Rien n’est supprimé avant ${v.days} jours`
        : `Nothing is deleted before ${v.days} days`,
    rule: (v) =>
      `forbid (principal, action == ${Kete('document.delete')}, resource)\n  when { context.ageDays < ${v.days} };`,
  },
  {
    id: 'retention.confidential',
    family: 'retention',
    set: 'authority',
    blanks: [],
    sentence: (_, l) =>
      l === 'fr'
        ? 'Un document confidentiel, seuls ses lecteurs'
        : 'A confidential document, its readers only',
    rule: () =>
      `forbid (principal is Kete::Person, action == ${Kete('document.read')}, resource)\n  when { resource.confidential && !resource.readers.contains(principal) };`,
  },
  // 6. Consent of outside contacts.
  {
    id: 'consent.stop',
    family: 'consent',
    set: 'authority',
    blanks: [],
    sentence: (_, l) =>
      l === 'fr'
        ? 'Un contact qui a écrit STOP ne reçoit plus rien'
        : 'A contact who wrote STOP receives nothing more',
    rule: () =>
      `forbid (principal, action == ${Kete('message.client')}, resource)\n  when { resource.optedOut || !resource.consent };`,
  },
];

export class TemplateError extends Error {
  constructor(
    readonly code: 'unknown_template' | 'invalid_blank',
    message: string,
  ) {
    super(message);
    this.name = 'TemplateError';
  }
}

const channels = new Set<Channel>(['whatsapp', 'mail', 'telegram', 'phone']);
const integer = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

function checkBlanks(template: PolicyTemplate, values: Blanks): Required<Blanks> {
  const bad = (name: BlankName) => {
    throw new TemplateError('invalid_blank', `The blank « ${name} » is not filled as it should.`);
  };
  for (const name of template.blanks) {
    const value = values[name];
    if (name === 'amount' && !integer(value, 0, 1e15)) bad(name);
    if ((name === 'from' || name === 'to') && !integer(value, 0, 24)) bad(name);
    if (name === 'days' && !integer(value, 1, 36500)) bad(name);
    if (name === 'approver' && !(typeof value === 'string' && value in approvers)) bad(name);
    if (
      name === 'channels' &&
      !(Array.isArray(value) && value.length > 0 && value.every((c) => channels.has(c as Channel)))
    ) {
      bad(name);
    }
  }
  if (template.blanks.includes('from') && (values.from ?? 0) >= (values.to ?? 0)) bad('to');
  return {
    amount: 0,
    approver: 'manager',
    channels: [],
    from: 0,
    to: 24,
    days: 1,
    ...values,
  } as Required<Blanks>;
}

/**
 * A policy from a template, its blanks filled: on trial until its owner turns it on — observed,
 * never enforced. The product saves it with `savePolicy`, which checks the rule against its schema.
 */
export function fillTemplate(
  templateId: string,
  values: Blanks,
  options: { owner: string; locale?: 'fr' | 'en'; id?: string },
): Omit<Policy, 'version'> {
  const template = policyTemplates.find((t) => t.id === templateId);
  if (!template) throw new TemplateError('unknown_template', `No template « ${templateId} ».`);
  const filled = checkBlanks(template, values);
  const approver =
    template.approver ?? (template.blanks.includes('approver') ? filled.approver : undefined);
  return {
    id: options.id ?? template.id,
    sentence: template.sentence(filled, options.locale ?? 'fr'),
    rule: template.rule(filled),
    set: template.set,
    ...(approver ? { approver } : {}),
    owner: options.owner,
    status: 'trial',
  };
}

export interface Simulation {
  /** The gestures of the period, replayed. */
  replayed: number;
  /** Those it would have decided otherwise. */
  changed: { decisionId: string; at: Date; gesture: Gesture; before: string; after: string }[];
}

/**
 * What a policy would have decided (spec 139, FR-014): the gestures journaled since a moment are
 * decided again under the current policies, then with this one in force, and those whose effect
 * changes are listed. The product gives the entities as it gives them to a decision.
 */
export async function simulatePolicy(
  db: SqlExecutor,
  input: {
    engine: PolicyEngine;
    policy: Omit<Policy, 'version'>;
    since: Date;
    entitiesOf(gesture: Gesture): Promise<readonly Entity[]> | readonly Entity[];
    limit?: number;
  },
): Promise<Simulation> {
  const current = (await currentPolicies(db)).filter((p) => p.status !== 'off');
  const previous = current.find((p) => p.id === input.policy.id);
  const withIt: Policy[] = [
    ...current.filter((p) => p.id !== input.policy.id),
    { ...input.policy, status: 'active', version: (previous?.version ?? 0) + 1 },
  ];
  const { rows } = await db.query<{ decision_id: string; gesture: Gesture; at: Date }>(
    `select decision_id, gesture, at from kete_policy_decisions
      where at >= $1 order by at, decision_id limit $2`,
    [input.since, Math.min(Math.max(input.limit ?? 1000, 1), 5000)],
  );
  const changed: Simulation['changed'] = [];
  for (const row of rows) {
    const entities = await input.entitiesOf(row.gesture);
    const before = input.engine.decide({ policies: current, gesture: row.gesture, entities });
    const after = input.engine.decide({ policies: withIt, gesture: row.gesture, entities });
    if (before.effect !== after.effect) {
      changed.push({
        decisionId: row.decision_id,
        at: new Date(row.at),
        gesture: row.gesture,
        before: before.effect,
        after: after.effect,
      });
    }
  }
  return { replayed: rows.length, changed };
}
