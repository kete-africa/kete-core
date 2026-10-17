import { createHash } from 'node:crypto';

// The center (Kete Enterprise) as an app sees it (kete-core spec 049): every call carries the
// person's token, so the center answers within her rights — never more. When the center is not
// configured, or does not answer, the app goes on alone: nothing here throws at the app.

/** What a center answers about a person, for one app (same shape as `@kete/capabilities`). */
export interface CenterGrants {
  managed: boolean;
  permissions: { permission: string; everywhere: boolean; units: string[] }[];
}

export interface CenterTask {
  /** The app's own key: sending it again updates the task. */
  key: string;
  title: string;
  href: string;
  dueAt?: string;
}

export interface CenterReading {
  quarter: string;
  indicator: string;
  value: number;
  proof: string;
}

/** A person as the directory shows her (Kete Enterprise spec 023). */
export interface DirectoryPerson {
  personId: string;
  name: string;
  email: string | null;
  /** Her Compte Kete account: what the apps know her by. */
  userId: string | null;
}

export interface DirectoryCard extends DirectoryPerson {
  positions: { positionId: string; title: string; unitId: string; unitName: string }[];
  /** Whoever holds the position hers reports to, past vacant ones, interim included. */
  managers: DirectoryPerson[];
  reports: DirectoryPerson[];
}

export interface DirectoryUnit {
  unitId: string;
  name: string;
  country: string | null;
  ancestors: { unitId: string; name: string }[];
  children: { unitId: string; name: string }[];
  people: (DirectoryPerson & { positionTitle: string })[];
}

/** A decision the app asks the center's circuits (Kete Enterprise spec 023). */
export interface DecisionAsked {
  /** A subject the app's card declares (`subjects`): `purchase`. */
  subject: string;
  /** The app's own id of what is to be decided: one request per subject and reference. */
  reference: string;
  title: string;
  /** The amount or level the circuit's thresholds read. */
  measure?: number;
  unitId?: string;
  /** The project of the center it belongs to: a step of the circuit may be its lead's. */
  projectId?: string;
  /**
   * Where the app is told it was decided or sent back: only the request's id is sent. Asked again
   * with the same subject and reference after a return, it is the same request, corrected.
   */
  callbackUrl?: string;
}

export interface CenterDecision {
  requestId: string;
  subject: string;
  reference: string;
  /** `returned`: sent back to who asked, to be corrected and asked again (Enterprise spec 075). */
  status: 'pending' | 'approved' | 'refused' | 'returned';
  /** Who gave the last word. */
  decidedBy: string | null;
  /** Why, when refused or sent back. */
  reason: string | null;
}

/** A third party as the center holds it (Kete Enterprise spec 073): one record, cited by its id. */
export interface CenterParty {
  partyId: string;
  kind: 'company' | 'person';
  name: string;
  roles: ('client' | 'supplier' | 'funder' | 'partner')[];
  email: string | null;
  phone: string | null;
  address: string | null;
  registration: string | null;
  channel: 'whatsapp' | 'telegram' | 'email' | 'phone' | null;
  /** The records merged into this one: an app that kept one of them moves to `partyId`. */
  mergedFrom: string[];
}

/** What the app knows of a third party, shown on its record in the center. */
export interface PartyFact {
  /** The app's own key: said again, it is replaced. */
  key: string;
  label: string;
  state?: string | null;
  href?: string | null;
}

/** A project as the center holds it (Kete Enterprise spec 074). */
export interface CenterProject {
  projectId: string;
  name: string;
  party: { partyId: string; name: string } | null;
  lead: { userId: string; name: string };
  status: 'open' | 'delivered' | 'closed';
  phase: string | null;
  /** In the currency's smallest unit (`@kete/money`). */
  sold: number | null;
  currency: string;
  team: { userId: string; name: string; lead: boolean }[];
  posts: { postId: string; name: string; budget: number }[];
  budget: number;
}

/** A project an app opens from its own document: asked twice, it is the same project. */
export interface ProjectOpened {
  name: string;
  /** The app's document it is born from: a won quote's reference. */
  reference: string;
  partyId?: string;
  lead?: { userId: string; name: string };
  sold?: number;
  currency?: string;
  /** The document's lines, as the posts of its budget; two lines on one post add up. */
  posts?: { name: string; budget: number }[];
}

/**
 * A fact of money (contract `money-fact.v1`): said again under its key, it replaces what was
 * said — an invoice's amount is what is still due, a commitment's what is still to pay.
 */
export interface MoneyFact {
  key: string;
  kind: 'invoiced' | 'received' | 'committed' | 'spent';
  /** In the currency's smallest unit: an integer, never negative. */
  amount: number;
  currency: string;
  /** The day it became true, `2026-10-13`. */
  occurredOn: string;
  label: string;
  projectId?: string;
  /** The post of the project's budget it counts against, by its name. */
  post?: string;
  partyId?: string;
  href?: string;
}

/**
 * A dated fact (contract `dated-fact.v1`; doctrine D-050): something the app says will happen at a
 * time — a meeting, a deadline, an absence, a task, a milestone, an agent's run — for the center's
 * Planifier. Said again under its key, it replaces what was said. Exactly one of `day` and
 * `startsAt` is given.
 */
export interface DatedFact {
  key: string;
  kind: 'meeting' | 'deadline' | 'absence' | 'task' | 'milestone' | 'agent_run';
  /** As a person reads it: « Échéance F-2026-0003 ». */
  label: string;
  /** A whole day, `2026-10-15`; with `until`, the first day of a span. */
  day?: string;
  /** The last day of a span that started on `day`. */
  until?: string;
  /** A moment, ISO 8601 with its offset. */
  startsAt?: string;
  endsAt?: string;
  /** The people of the center it concerns: who meets, who is away, who must do it. */
  personIds?: string[];
  projectId?: string;
  partyId?: string;
  /** `shared` by default; `busy`: others see only that she is taken; `private`. */
  visibility?: 'shared' | 'busy' | 'private';
  href?: string;
}

/**
 * A thing in progress the app holds (contract `holding.v1`, kete-core spec 114): who holds it —
 * a person of the center, or an agent —, on what, waiting on whom. The app says them all at once;
 * the center finishes what it no longer says. Its source is the app's product.
 */
export interface AppHolding {
  /** What it is in the app: `invoice`, `leave`, `ticket`. */
  kind: string;
  /** The app's own id of it: one holding per kind and reference. */
  ref: string;
  /** What it is about: a project, a party, a contract, a ticket. */
  object: { kind: string; id: string };
  /** As a person reads it: « Relancer Garage Bè pour la facture F-2026-0003 ». */
  what: string;
  holder: { kind: 'person' | 'agent'; id: string };
  /** Who it waits for: a colleague, an agent, a party outside. */
  waitingOn?: { kind: 'person' | 'agent' | 'party'; id: string } | null;
  /** Since when it is in progress, ISO 8601. */
  since?: string;
  /** The day it is due, `2026-10-20`. */
  due?: string;
  /** `waiting` needs `waitingOn`. */
  state: 'held' | 'waiting';
  /** `information`: the holder is told, nothing more. */
  for?: 'action' | 'information';
  /** Where it opens: an https address of the app. */
  href?: string;
}

/**
 * A gesture the app is about to make, passed through the organization's policies (contract
 * `gesture.v1`, doctrine D-058): the same for the person and for her agent.
 */
export interface AppGesture {
  /** A gesture the center knows: `purchase.commit`, `contract.sign`, `assignment.make`… */
  kind: string;
  /** What it acts on: a project, a party, a subject. */
  object: { kind: string; id: string };
  amount?: { value: number; currency: string };
  channel?: string;
  party?: string;
  /** What else the policies read, flat: `budgetLeft`, `authorised`, `days`. */
  context?: Record<string, string | number | boolean>;
  /** The agent making it for the person whose token is given. */
  agent?: { id: string };
}

/**
 * What the policies said. `unruled`: nothing the organization wrote speaks of it — or there is no
 * center to ask —, the app follows its own rules. `refuse` stops the gesture, with the policies'
 * sentences; `approve` names who approves, by relation or role, with the people found today.
 */
export interface GestureVerdict {
  effect: 'allow' | 'approve' | 'refuse' | 'unruled';
  policies: { id: string; sentence: string }[];
  approvers: { approver: string; people: string[] }[];
  /** Why it is unruled: `not_connected`, `signed_out`, `unreachable`, `nothing_ruled`… */
  reason?: string;
}

export interface CenterOptions {
  /** The center's API, `https://api.enterprise.example`; empty when the app works alone. */
  url: string | null | undefined;
  /** The app's product id, as its manifest declares it: `prd_kete_helpdesk`. */
  product: string;
  /** How the center names the app in a person's To do: `kete-helpdesk`. */
  source: string;
  /** How long a person's grants are kept, in seconds (default 300, at most 300). */
  grantsSeconds?: number;
  fetch?: typeof fetch;
  now?: () => number;
}

export interface Center {
  /** Whether a center is configured. */
  readonly connected: boolean;
  /** Where the app delivers its business events, with its own token (null without a center). */
  readonly eventsUrl: string | null;
  /** The person's grants for this app; null without a center, a token, or an answer. */
  grants(token: string | null | undefined): Promise<CenterGrants | null>;
  /** Puts a task in the person's To do; sending it again updates it. */
  sendTask(token: string | null | undefined, task: CenterTask): Promise<void>;
  /** Takes a task out of her To do, once done here. */
  closeTask(token: string | null | undefined, key: string): Promise<void>;
  /** Who the person is in the organization: her positions, managers and reports. */
  me(token: string | null | undefined): Promise<DirectoryCard | null>;
  /** A colleague by her Compte Kete account; null when the person may not see her. */
  person(token: string | null | undefined, userId: string): Promise<DirectoryCard | null>;
  /** A unit, its place and its people; null when the person may not see it. */
  unit(token: string | null | undefined, unitId: string): Promise<DirectoryUnit | null>;
  /**
   * Asks the center's circuits to decide, for the person: who decides is found by the structure
   * and the thresholds, interim included. `no_circuit`: the organization has none for the subject,
   * the app applies its own rule.
   */
  requestDecision(
    token: string | null | undefined,
    decision: DecisionAsked,
  ): Promise<
    { ok: true; requestId: string; status: CenterDecision['status'] } | { ok: false; error: string }
  >;
  /** Where a decision stands, read with the app's own token (`kete:center`). */
  decision(
    appToken: string | null | undefined,
    organizationId: string,
    requestId: string,
  ): Promise<CenterDecision | null>;
  /** The third parties she may read, found by name or phone; none without a center. */
  parties(token: string | null | undefined, query?: string): Promise<CenterParty[]>;
  /**
   * A third party by its identifier, with the record that stays when it was merged: compare
   * `partyId` with what was asked. Null when she may not read it.
   */
  party(token: string | null | undefined, partyId: string): Promise<CenterParty | null>;
  /** Says what this app knows of a third party; `null` takes it back. */
  sayOfParty(
    token: string | null | undefined,
    partyId: string,
    fact: PartyFact | { key: string; gone: true },
  ): Promise<void>;
  /** The projects she belongs to — or all of them, when she reads them all. */
  projects(token: string | null | undefined): Promise<CenterProject[]>;
  /** A project of hers; null when she is outside it. */
  project(token: string | null | undefined, projectId: string): Promise<CenterProject | null>;
  /** The identifiers of the projects she belongs to: what the app filters her view by. */
  myProjectIds(token: string | null | undefined): Promise<string[]>;
  /** Opens a project from the app's own document, once: asked again, the same project answers. */
  openProject(
    token: string | null | undefined,
    project: ProjectOpened,
  ): Promise<{ ok: true; project: CenterProject; created: boolean } | { ok: false; error: string }>;
  /** Says a fact of money to the center, in the contract's shape; said again, it is replaced. */
  sendMoneyFact(
    token: string | null | undefined,
    fact: MoneyFact,
  ): Promise<{ ok: boolean; error: string | null }>;
  /** Takes a fact of money back: it was not true. */
  dropMoneyFact(token: string | null | undefined, key: string): Promise<void>;
  /** Says a dated fact to the center, in the contract's shape; said again, it is replaced. */
  sendDatedFact(
    token: string | null | undefined,
    fact: DatedFact,
  ): Promise<{ ok: boolean; error: string | null }>;
  /** Takes a dated fact back: it will not happen. */
  dropDatedFact(token: string | null | undefined, key: string): Promise<void>;
  /**
   * Says every thing the app has in progress for an organization, with the app's own token
   * (`kete:center`): the center keeps them as holdings — in « Pour moi », relayed when their
   * holder is away — and finishes those the app no longer says.
   */
  sayHoldings(
    appToken: string | null | undefined,
    organizationId: string,
    holdings: readonly AppHolding[],
  ): Promise<{ ok: true; said: number; finished: number } | { ok: false; error: string }>;
  /**
   * Passes a gesture through the organization's policies, for the person (or her agent) whose
   * token is given, before the app makes it. Never throws: without an answer, `unruled`.
   */
  checkGesture(token: string | null | undefined, gesture: AppGesture): Promise<GestureVerdict>;
  /** Sends an indicator's reading for her quarter's review. */
  sendReading(
    token: string | null | undefined,
    reading: CenterReading,
  ): Promise<{ ok: boolean; error: string | null }>;
}

const CACHE_LIMIT = 2000;

export function createCenter(options: CenterOptions): Center {
  const base = (options.url ?? '').trim().replace(/\/$/, '') || null;
  const call = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const keep = Math.min(Math.max(options.grantsSeconds ?? 300, 0), 300) * 1000;
  const cache = new Map<string, { at: number; value: CenterGrants }>();

  const headers = (token: string) => ({
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'kete-channel': 'api',
  });

  async function post(token: string, path: string, body: object): Promise<Response | null> {
    if (!base) return null;
    return call(`${base}${path}`, {
      method: 'POST',
      headers: { ...headers(token), 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);
  }

  async function read<T>(token: string | null | undefined, path: string): Promise<T | null> {
    if (!base || !token) return null;
    const response = await call(`${base}${path}`, {
      headers: headers(token),
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);
    if (!response?.ok) return null;
    return ((await response.json().catch(() => null)) as T | null) ?? null;
  }

  return {
    connected: base !== null,
    eventsUrl: base ? `${base}/public/apps/events` : null,

    async requestDecision(token, decision) {
      if (!base) return { ok: false, error: 'not_connected' };
      if (!token) return { ok: false, error: 'signed_out' };
      const response = await post(
        token,
        `/v1/apps/${encodeURIComponent(options.product)}/decisions`,
        decision,
      );
      if (!response) return { ok: false, error: 'unreachable' };
      const answer = (await response.json().catch(() => ({}))) as {
        requestId?: string;
        status?: CenterDecision['status'];
        error?: string;
      };
      return response.ok && answer.requestId && answer.status
        ? { ok: true, requestId: answer.requestId, status: answer.status }
        : { ok: false, error: answer.error ?? `http_${response.status}` };
    },

    async decision(appToken, organizationId, requestId) {
      if (!base || !appToken) return null;
      const response = await call(
        `${base}/public/apps/${encodeURIComponent(organizationId)}/decisions/${encodeURIComponent(requestId)}`,
        { headers: { authorization: `Bearer ${appToken}` }, signal: AbortSignal.timeout(4000) },
      ).catch(() => null);
      if (!response?.ok) return null;
      return ((await response.json().catch(() => null)) as CenterDecision | null) ?? null;
    },

    me: (token) => read<DirectoryCard>(token, '/v1/directory/me'),
    person: (token, userId) =>
      read<DirectoryCard>(token, `/v1/directory/people/${encodeURIComponent(userId)}`),
    unit: (token, unitId) =>
      read<DirectoryUnit>(token, `/v1/directory/units/${encodeURIComponent(unitId)}`),

    async grants(token) {
      if (!base || !token) return null;
      // Kept per token, never by the token itself: its hash.
      const key = createHash('sha256').update(token).digest('base64url');
      const kept = cache.get(key);
      if (kept && now() - kept.at < keep) return kept.value;
      const response = await call(`${base}/v1/apps/${encodeURIComponent(options.product)}/grants`, {
        headers: headers(token),
        signal: AbortSignal.timeout(4000),
      }).catch(() => null);
      if (!response?.ok) return null;
      const value = parseGrants(await response.json().catch(() => null));
      if (!value) return null;
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
      cache.set(key, { at: now(), value });
      return value;
    },

    async parties(token, query) {
      const found = await read<{ parties: CenterParty[] }>(
        token,
        `/v1/parties${query ? `?q=${encodeURIComponent(query)}` : ''}`,
      );
      return found?.parties ?? [];
    },

    async party(token, partyId) {
      const found = await read<{ party: CenterParty }>(
        token,
        `/v1/parties/${encodeURIComponent(partyId)}`,
      );
      return found?.party ?? null;
    },

    async sayOfParty(token, partyId, fact) {
      if (!token) return;
      const path = `/v1/parties/${encodeURIComponent(partyId)}/facts`;
      if ('gone' in fact) {
        await post(token, `${path}/drop`, { source: options.source, key: fact.key });
      } else {
        await post(token, path, { ...fact, source: options.source });
      }
    },

    async projects(token) {
      return (await read<{ projects: CenterProject[] }>(token, '/v1/projects'))?.projects ?? [];
    },

    async project(token, projectId) {
      const found = await read<{ project: CenterProject }>(
        token,
        `/v1/projects/${encodeURIComponent(projectId)}`,
      );
      return found?.project ?? null;
    },

    async myProjectIds(token) {
      return (await read<{ projectIds: string[] }>(token, '/v1/projects/mine'))?.projectIds ?? [];
    },

    async openProject(token, project) {
      if (!base) return { ok: false, error: 'not_connected' };
      if (!token) return { ok: false, error: 'signed_out' };
      const { reference, ...rest } = project;
      const response = await post(token, '/v1/projects', {
        ...rest,
        bornFrom: { source: options.source, ref: reference },
      });
      if (!response) return { ok: false, error: 'unreachable' };
      const answer = (await response.json().catch(() => ({}))) as {
        project?: CenterProject;
        created?: boolean;
        error?: string;
      };
      return response.ok && answer.project
        ? { ok: true, project: answer.project, created: answer.created === true }
        : { ok: false, error: answer.error ?? `http_${response.status}` };
    },

    async sendMoneyFact(token, fact) {
      if (!base) return { ok: false, error: 'not_connected' };
      if (!token) return { ok: false, error: 'signed_out' };
      const response = await post(token, '/v1/money/facts', {
        source: options.source,
        fact: moneyFactBody(fact),
      });
      if (!response) return { ok: false, error: 'unreachable' };
      if (response.ok) return { ok: true, error: null };
      const answer = (await response.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: answer.error ?? `http_${response.status}` };
    },

    async dropMoneyFact(token, key) {
      if (token) await post(token, '/v1/money/facts/drop', { source: options.source, key });
    },

    async sendDatedFact(token, fact) {
      if (!base) return { ok: false, error: 'not_connected' };
      if (!token) return { ok: false, error: 'signed_out' };
      const response = await post(token, '/v1/time/facts', {
        source: options.source,
        fact: datedFactBody(fact),
      });
      if (!response) return { ok: false, error: 'unreachable' };
      if (response.ok) return { ok: true, error: null };
      const answer = (await response.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: answer.error ?? `http_${response.status}` };
    },

    async dropDatedFact(token, key) {
      if (token) await post(token, '/v1/time/facts/drop', { source: options.source, key });
    },

    async sendTask(token, task) {
      if (token) await post(token, '/v1/workspace/tasks', { ...task, source: options.source });
    },

    async closeTask(token, key) {
      if (token) await post(token, '/v1/workspace/tasks/close', { key, source: options.source });
    },

    async sayHoldings(appToken, organizationId, holdings) {
      if (!base) return { ok: false, error: 'not_connected' };
      if (!appToken) return { ok: false, error: 'signed_out' };
      const response = await call(`${base}/public/apps/holdings`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${appToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          organization: organizationId,
          product: options.product,
          holdings: holdings.map((h) => holdingBody(options.product, h)),
        }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null);
      if (!response) return { ok: false, error: 'unreachable' };
      const answer = (await response.json().catch(() => ({}))) as {
        said?: number;
        finished?: number;
        error?: string;
      };
      return response.ok
        ? { ok: true, said: answer.said ?? 0, finished: answer.finished ?? 0 }
        : { ok: false, error: answer.error ?? `http_${response.status}` };
    },

    async checkGesture(token, gesture) {
      const unruled = (reason: string): GestureVerdict => ({
        effect: 'unruled',
        policies: [],
        approvers: [],
        reason,
      });
      if (!base) return unruled('not_connected');
      if (!token) return unruled('signed_out');
      const response = await post(
        token,
        `/v1/apps/${encodeURIComponent(options.product)}/gestures`,
        gesture,
      );
      if (!response?.ok) return unruled(response ? `http_${response.status}` : 'unreachable');
      return parseVerdict(await response.json().catch(() => null)) ?? unruled('unreadable');
    },

    async sendReading(token, reading) {
      if (!base) return { ok: false, error: 'not_connected' };
      if (!token) return { ok: false, error: 'signed_out' };
      const response = await post(token, '/v1/performance/readings', {
        ...reading,
        source: options.source,
      });
      if (!response) return { ok: false, error: 'unreachable' };
      if (response.ok) return { ok: true, error: null };
      const answer = (await response.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: answer.error ?? `http_${response.status}` };
    },
  };
}

/** A fact of money in its contract's shape (`contracts/money-fact.v1.schema.json`). */
export function moneyFactBody(fact: MoneyFact): Record<string, unknown> {
  return {
    key: fact.key,
    kind: fact.kind,
    amount: fact.amount,
    currency: fact.currency,
    occurred_on: fact.occurredOn,
    label: fact.label,
    ...(fact.projectId ? { project_id: fact.projectId } : {}),
    ...(fact.post ? { post: fact.post } : {}),
    ...(fact.partyId ? { party_id: fact.partyId } : {}),
    ...(fact.href ? { href: fact.href } : {}),
  };
}

/** A dated fact in its contract's shape (`contracts/dated-fact.v1.schema.json`). */
export function datedFactBody(fact: DatedFact): Record<string, unknown> {
  return {
    key: fact.key,
    kind: fact.kind,
    label: fact.label,
    ...(fact.day ? { day: fact.day } : {}),
    ...(fact.until ? { until: fact.until } : {}),
    ...(fact.startsAt ? { starts_at: fact.startsAt } : {}),
    ...(fact.endsAt ? { ends_at: fact.endsAt } : {}),
    ...(fact.personIds?.length ? { person_ids: fact.personIds } : {}),
    ...(fact.projectId ? { project_id: fact.projectId } : {}),
    ...(fact.partyId ? { party_id: fact.partyId } : {}),
    ...(fact.visibility ? { visibility: fact.visibility } : {}),
    ...(fact.href ? { href: fact.href } : {}),
  };
}

/** A holding in its contract's shape (`contracts/holding.v1.schema.json`), under the app's source. */
export function holdingBody(product: string, holding: AppHolding): Record<string, unknown> {
  return {
    source: { app: product, kind: holding.kind, ref: holding.ref },
    object: holding.object,
    what: holding.what.length > 300 ? `${holding.what.slice(0, 299)}…` : holding.what,
    holder: holding.holder,
    ...(holding.waitingOn ? { waiting_on: holding.waitingOn } : {}),
    ...(holding.since ? { since: holding.since } : {}),
    ...(holding.due ? { due: holding.due } : {}),
    state: holding.state,
    ...(holding.for ? { for: holding.for } : {}),
    ...(holding.href ? { href: holding.href } : {}),
  };
}

const EFFECTS = new Set(['allow', 'approve', 'refuse', 'unruled']);

/** The center's verdict, checked: anything else counts as no answer. */
function parseVerdict(value: unknown): GestureVerdict | null {
  const v = (value as { verdict?: Record<string, unknown> } | null)?.verdict;
  if (!v || typeof v.effect !== 'string' || !EFFECTS.has(v.effect)) return null;
  const policies = (Array.isArray(v.policies) ? v.policies : []).flatMap((p: unknown) => {
    const { id, sentence } = (p ?? {}) as { id?: unknown; sentence?: unknown };
    return typeof id === 'string' && typeof sentence === 'string' ? [{ id, sentence }] : [];
  });
  const approvers = (Array.isArray(v.approvers) ? v.approvers : []).flatMap((a: unknown) => {
    const { approver, people } = (a ?? {}) as { approver?: unknown; people?: unknown };
    return typeof approver === 'string' && Array.isArray(people)
      ? [{ approver, people: people.filter((p): p is string => typeof p === 'string') }]
      : [];
  });
  return {
    effect: v.effect as GestureVerdict['effect'],
    policies,
    approvers,
    ...(typeof v.reason === 'string' ? { reason: v.reason } : {}),
  };
}

/** A center's answer, checked: anything else counts as no answer. */
function parseGrants(value: unknown): CenterGrants | null {
  if (typeof value !== 'object' || value === null) return null;
  const { managed, permissions } = value as Record<string, unknown>;
  if (typeof managed !== 'boolean' || !Array.isArray(permissions)) return null;
  const list = permissions.flatMap((p) => {
    const g = p as Record<string, unknown>;
    return typeof g.permission === 'string' &&
      typeof g.everywhere === 'boolean' &&
      Array.isArray(g.units)
      ? [
          {
            permission: g.permission,
            everywhere: g.everywhere,
            units: g.units.filter((u): u is string => typeof u === 'string'),
          },
        ]
      : [];
  });
  return { managed, permissions: list };
}
