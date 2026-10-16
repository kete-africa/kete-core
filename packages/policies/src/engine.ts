import { createHash } from 'node:crypto';
import * as cedar from '@cedar-policy/cedar-wasm/nodejs';
import type { Gesture, Policy, PolicyDecision } from '@kete/sdk';

// One engine at the gesture (doctrine D-058, spec 112), on Cedar run in the process. Cedar answers
// allow or deny; the three effects come from three policy sets (specs/112-policies/first-check.md):
//   authority — what may be done at all: a forbid refuses, nothing permitted refuses;
//   approval  — a permit here means « this needs someone's approval »;
//   trial     — the policies on trial, evaluated on every gesture, journaled, never enforced.
// A policy that fails to evaluate in the authority set refuses: the engine never fails open.

/** An entity the product gives Cedar for a gesture: who acts, on what, and what they relate to. */
export type Entity = cedar.EntityJson;
type Cited = PolicyDecision['policies'][number];

export interface CedarRequest {
  principal: { type: string; id: string };
  action: string;
  resource: { type: string; id: string };
  context: Record<string, cedar.CedarValueJson>;
}

export interface PolicyEngine {
  /** Whether a rule parses, is one policy, and fits the product's schema (strict). */
  check(rule: string): { ok: boolean; errors: string[] };
  /** The decision for a gesture, under the organization's current policies. */
  decide(input: {
    policies: readonly Policy[];
    gesture: Gesture;
    entities: readonly Entity[];
  }): PolicyDecision;
  /** How the engine reads a gesture as a Cedar request (the product may give its own). */
  requestOf(gesture: Gesture): CedarRequest;
}

const capitalized = (kind: string) =>
  kind
    .split(/[._-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

/**
 * The default reading of a gesture: `Ns::Person` or `Ns::Agent` acts, `Ns::Action::"kind"` on
 * `Ns::<ObjectKind>`; the context carries the amount, channel, party, template and the gesture's
 * own context, flat.
 */
export function defaultRequestOf(namespace: string) {
  return (gesture: Gesture): CedarRequest => ({
    principal: {
      type: `${namespace}::${gesture.actor.kind === 'agent' ? 'Agent' : 'Person'}`,
      id: gesture.actor.id,
    },
    action: gesture.kind,
    resource: { type: `${namespace}::${capitalized(gesture.object.kind)}`, id: gesture.object.id },
    context: {
      ...(gesture.amount
        ? { amount: gesture.amount.value, currency: gesture.amount.currency }
        : {}),
      ...(gesture.channel ? { channel: gesture.channel } : {}),
      ...(gesture.party ? { party: gesture.party } : {}),
      ...(gesture.template ? { template: gesture.template } : {}),
      ...(gesture.context ?? {}),
    },
  });
}

const messages = (errors: readonly cedar.DetailedError[]) => errors.map((e) => e.message);

/**
 * The context attributes each action declares in the schema: Cedar refuses a context with an
 * attribute its action does not declare, so a gesture gives each action only its own.
 */
function declaredContexts(schema: string, namespace: string): Map<string, Set<string>> {
  const answer = cedar.schemaToJson(schema);
  if (answer.type !== 'success') {
    throw new TypeError(`The policy schema does not parse: ${messages(answer.errors).join('; ')}`);
  }
  const space = answer.json[namespace];
  const declared = new Map<string, Set<string>>();
  type Shape = { type: string; attributes?: Record<string, unknown> };
  const common = (space?.commonTypes ?? {}) as Record<string, Shape>;
  for (const [action, definition] of Object.entries(space?.actions ?? {})) {
    let context = (definition.appliesTo?.context ?? null) as Shape | null;
    if (context && context.type !== 'Record') context = common[context.type] ?? null;
    declared.set(action, new Set(Object.keys(context?.attributes ?? {})));
  }
  return declared;
}

let sets = 0;

export function createPolicyEngine(options: {
  /** The product's Cedar schema, in Cedar's text form. */
  schema: string;
  /** Its namespace (default `Kete`). */
  namespace?: string;
  requestOf?: (gesture: Gesture) => CedarRequest;
}): PolicyEngine {
  const namespace = options.namespace ?? 'Kete';
  const requestOf = options.requestOf ?? defaultRequestOf(namespace);
  const contexts = declaredContexts(options.schema, namespace);
  const schemaName = `schema-${++sets}`;
  const parsed = cedar.preparseSchema(schemaName, options.schema);
  if (parsed.type !== 'success') {
    throw new TypeError(`The policy schema does not parse: ${messages(parsed.errors).join('; ')}`);
  }
  // A preparsed set per content: a policy's change makes a new set. The key is the rules
  // themselves, never their ids and versions: two organizations may each have a version 1 of a
  // policy of the same id with different rules.
  const preparsed = new Map<string, string>();
  const setOf = (policies: readonly Policy[]): string | null => {
    if (policies.length === 0) return null;
    const key = createHash('sha256')
      .update(JSON.stringify(policies.map((p) => [p.id, p.rule])))
      .digest('hex');
    const known = preparsed.get(key);
    if (known) return known;
    const id = `set-${++sets}`;
    const answer = cedar.preparsePolicySet(id, {
      staticPolicies: Object.fromEntries(policies.map((p) => [p.id, p.rule])),
    });
    if (answer.type !== 'success') {
      throw new TypeError(`A policy does not parse: ${messages(answer.errors).join('; ')}`);
    }
    preparsed.set(key, id);
    return id;
  };

  const evaluate = (
    policies: readonly Policy[],
    request: CedarRequest,
    entities: readonly Entity[],
  ) => {
    const set = setOf(policies);
    if (!set) return { decision: 'deny' as const, reason: [] as string[], errors: [] as string[] };
    const declared = contexts.get(request.action) ?? new Set<string>();
    const answer = cedar.statefulIsAuthorized({
      principal: request.principal,
      action: { type: `${namespace}::Action`, id: request.action },
      resource: request.resource,
      context: Object.fromEntries(
        Object.entries(request.context).filter(([name]) => declared.has(name)),
      ),
      preparsedPolicySetId: set,
      preparsedSchemaName: schemaName,
      entities: [...entities],
      validateRequest: false,
    });
    if (answer.type !== 'success') {
      throw new TypeError(
        `The gesture could not be evaluated: ${messages(answer.errors).join('; ')}`,
      );
    }
    return {
      decision: answer.response.decision,
      reason: answer.response.diagnostics.reason,
      errors: answer.response.diagnostics.errors.map((e) => e.policyId),
    };
  };

  const cite = (byId: Map<string, Policy>, ids: readonly string[], effect: Cited['effect']) =>
    ids.flatMap((id) => {
      const policy = byId.get(id);
      return policy ? [{ id, version: policy.version, effect, reason: policy.sentence }] : [];
    });

  return {
    requestOf,
    check(rule) {
      const answer = cedar.validate({
        schema: options.schema,
        policies: { staticPolicies: { candidate: rule } },
        validationSettings: { mode: 'strict' },
      });
      if (answer.type !== 'success') return { ok: false, errors: messages(answer.errors) };
      const errors = answer.validationErrors.map((e) => e.error.message);
      const parts = cedar.policySetTextToParts(rule);
      const one =
        parts.type === 'success' &&
        parts.policies.length === 1 &&
        parts.policy_templates.length === 0;
      if (!one) errors.push('A policy is one permit or one forbid.');
      return { ok: errors.length === 0, errors };
    },
    decide({ policies, gesture, entities }) {
      const request = requestOf(gesture);
      const active = policies.filter((p) => p.status === 'active');
      const byId = new Map(policies.map((p) => [p.id, p]));
      const authority = active.filter((p) => p.set === 'authority');
      const approval = active.filter((p) => p.set === 'approval');
      const onTrial = policies.filter((p) => p.status === 'trial');

      // What the policies on trial would have said: a forbid that matched, a permit that asked.
      const trial: Cited[] = [];
      const trialAuthority = onTrial.filter((p) => p.set === 'authority');
      if (trialAuthority.length > 0) {
        // Read with the active authority: would this one have turned an allowance into a refusal?
        const seen = evaluate([...authority, ...trialAuthority], request, entities);
        const refusing = seen.reason.filter((id) => byId.get(id)?.status === 'trial');
        if (seen.decision === 'deny') trial.push(...cite(byId, refusing, 'refuse'));
      }
      const trialApproval = onTrial.filter((p) => p.set === 'approval');
      if (trialApproval.length > 0) {
        trial.push(...cite(byId, evaluate(trialApproval, request, entities).reason, 'approve'));
      }

      const power = evaluate(authority, request, entities);
      // A policy that failed to evaluate refuses; so does a forbid that matched, or nothing permitted.
      if (power.errors.length > 0) {
        return { effect: 'refuse', policies: cite(byId, power.errors, 'refuse'), trial };
      }
      if (power.decision === 'deny') {
        return { effect: 'refuse', policies: cite(byId, power.reason, 'refuse'), trial };
      }
      // An approval policy that fails to evaluate asks too: the engine never fails open.
      const asking = evaluate(approval, request, entities);
      const asked = [...new Set([...asking.reason, ...asking.errors])];
      if (asked.length > 0) {
        const approvers = [...new Set(asked.map((id) => byId.get(id)?.approver ?? 'manager'))];
        return { effect: 'approve', approvers, policies: cite(byId, asked, 'approve'), trial };
      }
      return { effect: 'allow', policies: cite(byId, power.reason, 'allow'), trial };
    },
  };
}
