import type { Gesture, Policy } from '@kete/sdk';
import type { Entity, Expectation } from '../src/index.js';

// KYA's six policies (spec 112, FR-005), as written for the first check (first-check.md), with
// the people, the agent, a client, a project, a document and a card they read.

export const schema = `
namespace Kete {
  entity Person { manager?: Person, deputy?: Person, spendingLimit: Long, signs: Bool };
  entity Agent { onBehalfOf: Person, level: Long };
  entity Party { consent: Bool, optedOut: Bool };
  entity Project { holder: Person, budgetLeft: Long };
  entity Document { confidential: Bool, readers: Set<Person> };
  entity Card { holder: Person };
  action "contract.sign" appliesTo { principal: [Person, Agent], resource: Project,
    context: { amount: Long } };
  action "purchase.commit" appliesTo { principal: [Person, Agent], resource: Project,
    context: { amount: Long } };
  action "message.client" appliesTo { principal: [Person, Agent], resource: Party,
    context: { channel: String, hour: Long, approvedTemplate: Bool } };
  action "document.read" appliesTo { principal: [Person, Agent], resource: Document, context: {} };
  action "document.delete" appliesTo { principal: [Person, Agent], resource: Document,
    context: { ageDays: Long, retentionDays: Long } };
  action "card.decide" appliesTo { principal: [Person], resource: Card,
    context: { holderAbsent: Bool } };
}`;

const authority = (id: string, sentence: string, rule: string): Policy => ({
  id,
  version: 1,
  sentence,
  rule,
  set: 'authority',
  owner: 'usr_abla',
  status: 'active',
});
const approval = (id: string, sentence: string, approver: string, rule: string): Policy => ({
  ...authority(id, sentence, rule),
  set: 'approval',
  approver,
});

export const policies: Policy[] = [
  // 1. Who commits the company.
  authority(
    'signature.people',
    'Signe qui a le pouvoir de signature',
    `permit (principal is Kete::Person, action == Kete::Action::"contract.sign", resource)
      when { principal.signs };`,
  ),
  authority(
    'signature.no-agent',
    'Un agent ne signe jamais',
    `forbid (principal is Kete::Agent, action == Kete::Action::"contract.sign", resource);`,
  ),
  approval(
    'signature.big',
    'Au-delà de 5 000 000 F, la direction approuve la signature',
    'direction',
    `permit (principal, action == Kete::Action::"contract.sign", resource)
      when { context.amount > 5000000 };`,
  ),
  // 2. Who speaks to clients, on which channel, in which hours, with which templates.
  authority(
    'clients.speak',
    'On écrit aux clients par WhatsApp ou par mail',
    `permit (principal, action == Kete::Action::"message.client", resource)
      when { ["whatsapp", "mail"].contains(context.channel) };`,
  ),
  authority(
    'clients.hours',
    'Un agent n’écrit pas aux clients avant 8 h ni après 19 h',
    `forbid (principal is Kete::Agent, action == Kete::Action::"message.client", resource)
      when { context.hour < 8 || context.hour >= 19 };`,
  ),
  approval(
    'clients.no-template',
    'Un agent qui écrit sans modèle approuvé demande à sa personne',
    'on_behalf_of',
    `permit (principal is Kete::Agent, action == Kete::Action::"message.client", resource)
      unless { context.approvedTemplate };`,
  ),
  // 3. Spending limits.
  authority(
    'spend.people',
    'Une personne engage un achat',
    `permit (principal is Kete::Person, action == Kete::Action::"purchase.commit", resource);`,
  ),
  authority(
    'spend.agents',
    'Un agent de niveau 2 engage un achat',
    `permit (principal is Kete::Agent, action == Kete::Action::"purchase.commit", resource)
      when { principal.level >= 2 };`,
  ),
  approval(
    'spend.over-limit',
    'Au-delà de sa limite, son responsable approuve',
    'manager',
    `permit (principal is Kete::Person, action == Kete::Action::"purchase.commit", resource)
      when { context.amount > principal.spendingLimit };`,
  ),
  approval(
    'spend.agent-over-limit',
    'Un agent au-delà de la limite de sa personne, ou de 200 000 F, demande à sa personne',
    'on_behalf_of',
    `permit (principal is Kete::Agent, action == Kete::Action::"purchase.commit", resource)
      when { context.amount > principal.onBehalfOf.spendingLimit || context.amount > 200000 };`,
  ),
  approval(
    'spend.over-budget',
    'Au-delà du budget restant, le responsable du projet approuve',
    'project.holder',
    `permit (principal, action == Kete::Action::"purchase.commit", resource)
      when { context.amount > resource.budgetLeft };`,
  ),
  // 4. Deputies.
  authority(
    'deputy.decide',
    'Le titulaire décide sa carte ; son suppléant pendant son absence',
    `permit (principal, action == Kete::Action::"card.decide", resource)
      when { principal == resource.holder ||
        (context.holderAbsent && resource.holder has deputy && resource.holder.deputy == principal) };`,
  ),
  // 5. Retention and confidentiality.
  authority(
    'docs.read',
    'On lit les documents',
    `permit (principal, action == Kete::Action::"document.read", resource);`,
  ),
  authority(
    'docs.confidential',
    'Un document confidentiel, seuls ses lecteurs',
    `forbid (principal is Kete::Person, action == Kete::Action::"document.read", resource)
      when { resource.confidential && !resource.readers.contains(principal) };`,
  ),
  authority(
    'docs.confidential-agent',
    'Un agent lit un document confidentiel seulement si sa personne le peut',
    `forbid (principal is Kete::Agent, action == Kete::Action::"document.read", resource)
      when { resource.confidential && !resource.readers.contains(principal.onBehalfOf) };`,
  ),
  authority(
    'docs.delete',
    'Une personne supprime un document',
    `permit (principal is Kete::Person, action == Kete::Action::"document.delete", resource);`,
  ),
  authority(
    'docs.retention',
    'Rien n’est supprimé avant la fin de sa conservation',
    `forbid (principal, action == Kete::Action::"document.delete", resource)
      when { context.ageDays < context.retentionDays };`,
  ),
  // 6. Consent of outside contacts.
  authority(
    'consent.stop',
    'Un contact qui a écrit STOP ne reçoit plus rien',
    `forbid (principal, action == Kete::Action::"message.client", resource)
      when { resource.optedOut || !resource.consent };`,
  ),
];

const uid = (type: string, id: string) => ({ type: `Kete::${type}`, id });
const ref = (type: string, id: string) => ({ __entity: uid(type, id) });

export const entities: Entity[] = [
  { uid: uid('Person', 'abla'), attrs: { spendingLimit: 2000000, signs: true }, parents: [] },
  {
    uid: uid('Person', 'kossi'),
    attrs: {
      manager: ref('Person', 'abla'),
      deputy: ref('Person', 'yao'),
      spendingLimit: 150000,
      signs: false,
    },
    parents: [],
  },
  { uid: uid('Person', 'yao'), attrs: { spendingLimit: 100000, signs: false }, parents: [] },
  {
    uid: uid('Agent', 'relances'),
    attrs: { onBehalfOf: ref('Person', 'kossi'), level: 2 },
    parents: [],
  },
  { uid: uid('Party', 'garage-be'), attrs: { consent: true, optedOut: false }, parents: [] },
  { uid: uid('Party', 'hotel-golfe'), attrs: { consent: true, optedOut: true }, parents: [] },
  {
    uid: uid('Project', 'colombe'),
    attrs: { holder: ref('Person', 'abla'), budgetLeft: 300000 },
    parents: [],
  },
  {
    uid: uid('Document', 'paie'),
    attrs: { confidential: true, readers: [ref('Person', 'abla')] },
    parents: [],
  },
  { uid: uid('Card', 'achat-1'), attrs: { holder: ref('Person', 'kossi') }, parents: [] },
];

const AT = '2026-10-23T10:00:00Z';
const kossi = { kind: 'person', id: 'kossi' } as const;
const abla = { kind: 'person', id: 'abla' } as const;
const yao = { kind: 'person', id: 'yao' } as const;
const agent = { kind: 'agent', id: 'relances', on_behalf_of: 'kossi' } as const;
const xof = (value: number) => ({ value, currency: 'XOF' });

export const gesture = (
  actor: Gesture['actor'],
  kind: string,
  object: Gesture['object'],
  extra: Partial<Gesture> = {},
): Gesture => ({ actor, kind, object, at: AT, ...extra });

const colombe = { kind: 'project', id: 'colombe' };
const garage = { kind: 'party', id: 'garage-be' };
const message = (actor: Gesture['actor'], channel: string, hour: number, approved: boolean) =>
  gesture(actor, 'message.client', garage, {
    channel,
    context: { hour, approvedTemplate: approved },
  });

export const expectations: Expectation[] = [
  {
    name: 'Kossi achète 120 000 F',
    gesture: gesture(kossi, 'purchase.commit', colombe, { amount: xof(120000) }),
    effect: 'allow',
  },
  {
    name: 'son agent achète 120 000 F pour lui',
    gesture: gesture(agent, 'purchase.commit', colombe, { amount: xof(120000) }),
    effect: 'allow',
  },
  {
    name: 'Kossi achète 180 000 F',
    gesture: gesture(kossi, 'purchase.commit', colombe, { amount: xof(180000) }),
    effect: 'approve',
  },
  {
    name: 'son agent achète 180 000 F',
    gesture: gesture(agent, 'purchase.commit', colombe, { amount: xof(180000) }),
    effect: 'approve',
  },
  {
    name: 'Abla achète 400 000 F, au-delà du budget',
    gesture: gesture(abla, 'purchase.commit', colombe, { amount: xof(400000) }),
    effect: 'approve',
  },
  {
    name: 'l’agent signe un contrat',
    gesture: gesture(agent, 'contract.sign', colombe, { amount: xof(100) }),
    effect: 'refuse',
  },
  {
    name: 'Kossi signe, sans pouvoir',
    gesture: gesture(kossi, 'contract.sign', colombe, { amount: xof(100) }),
    effect: 'refuse',
  },
  {
    name: 'Abla signe 8 000 000 F',
    gesture: gesture(abla, 'contract.sign', colombe, { amount: xof(8000000) }),
    effect: 'approve',
  },
  {
    name: 'l’agent écrit à 10 h avec un modèle',
    gesture: message(agent, 'whatsapp', 10, true),
    effect: 'allow',
  },
  { name: 'l’agent écrit à 21 h', gesture: message(agent, 'whatsapp', 21, true), effect: 'refuse' },
  {
    name: 'l’agent écrit sans modèle',
    gesture: message(agent, 'mail', 10, false),
    effect: 'approve',
  },
  { name: 'Kossi écrit par SMS', gesture: message(kossi, 'sms', 10, true), effect: 'refuse' },
  {
    name: 'le client a écrit STOP : même Abla',
    gesture: gesture(
      abla,
      'message.client',
      { kind: 'party', id: 'hotel-golfe' },
      { channel: 'whatsapp', context: { hour: 10, approvedTemplate: true } },
    ),
    effect: 'refuse',
  },
  {
    name: 'Kossi lit la paie',
    gesture: gesture(kossi, 'document.read', { kind: 'document', id: 'paie' }),
    effect: 'refuse',
  },
  {
    name: 'l’agent de Kossi lit la paie',
    gesture: gesture(agent, 'document.read', { kind: 'document', id: 'paie' }),
    effect: 'refuse',
  },
  {
    name: 'Abla supprime un document de 2 ans gardé 10 ans',
    gesture: gesture(
      abla,
      'document.delete',
      { kind: 'document', id: 'paie' },
      { context: { ageDays: 730, retentionDays: 3650 } },
    ),
    effect: 'refuse',
  },
  {
    name: 'Yao décide la carte de Kossi absent',
    gesture: gesture(
      yao,
      'card.decide',
      { kind: 'card', id: 'achat-1' },
      { context: { holderAbsent: true } },
    ),
    effect: 'allow',
  },
  {
    name: 'Yao décide la carte de Kossi présent',
    gesture: gesture(
      yao,
      'card.decide',
      { kind: 'card', id: 'achat-1' },
      { context: { holderAbsent: false } },
    ),
    effect: 'refuse',
  },
];
