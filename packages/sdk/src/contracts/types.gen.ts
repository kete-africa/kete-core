// Generated from /contracts by `pnpm contracts:generate`. Do not edit.
/* eslint-disable */

/**
 * A gesture or a query a Kete product exposes to agents (MCP, chat, other apps), with its autonomy level: 1 read and signal, 2 act reversibly (with a notification and undo), 3 prepare a decision (a draft a person validates), 4 irreversible, money or external (always a person, with confirmation). It may name the view a copilot shows with its result (MCP Apps, doctrine D-037).
 */
export interface Capability {
  /**
   * snake_case: a valid tool name for MCP and every model provider.
   */
  name: string;
  description: string;
  autonomy: 1 | 2 | 3 | 4;
  reversible: boolean;
  /**
   * The command that undoes it (a @kete/commands name, kebab-case).
   */
  inverse?: string;
  permission: string;
  /**
   * The input's JSON Schema.
   */
  input: {
    [k: string]: unknown;
  };
  /**
   * The output's JSON Schema, when declared.
   */
  output?: {
    [k: string]: unknown;
  };
  /**
   * The view a host shows with the result, as an MCP Apps UI resource: ui://kete/review for a draft to verify, or a view of the product.
   */
  view?: string;
  /**
   * How far the data may travel. public: anyone; internal (the default): the organization's people with the permission; confidential: a need to know, never in a shared briefing; secret: never sent to a model, a shared briefing nor a notification's text.
   */
  classification?: 'public' | 'internal' | 'confidential' | 'secret';
}

/**
 * A set of rows a Kete product exposes to people's dashboards, to its assistant and to other apps, always under the reader's rights: its name, what it holds, the permission to read it, the JSON Schema of one row, and which fields are a date, measures or dimensions. Read at the product's API: GET {api}/datasets/{name}.
 */
export interface Dataset {
  name: string;
  description: string;
  permission: string;
  /**
   * The JSON Schema of one row.
   */
  row: {
    [k: string]: unknown;
  };
  /**
   * The field that dates a row: the API filters on it with `from` and `to`.
   */
  time?: string;
  /**
   * Numeric fields a dashboard sums, averages or counts.
   */
  measures?: string[];
  /**
   * Fields a dashboard groups by.
   */
  dimensions?: string[];
  /**
   * How far the data may travel. public: anyone; internal (the default): the organization's people with the permission; confidential: a need to know, never in a shared briefing; secret: never sent to a model, a shared briefing nor a notification's text.
   */
  classification?: 'public' | 'internal' | 'confidential' | 'secret';
}

/**
 * Something an app says will happen at a time — a meeting, a deadline, an absence, a task, a milestone, an agent's run — so that the center's Planifier shows the time of the whole organization (doctrine D-050). Sent again under the same key, it replaces what was said; sent with `cancelled`, it is taken back. Exactly one of `day` (a whole day) or `starts_at` (a moment) is given.
 */
export type DatedFact = {
  /**
   * The app's own key for this fact: one fact per app and key.
   */
  key: string;
  /**
   * meeting: people meet. deadline: something is due (an invoice, a report, a contract's term). absence: a person is away. task: a piece of work with its duration. milestone: a step of a project. agent_run: an agent or a routine will run.
   */
  kind: 'meeting' | 'deadline' | 'absence' | 'task' | 'milestone' | 'agent_run';
  /**
   * What it is, as a person reads it: « Échéance F-2026-0003 », « Réception du matériel ».
   */
  label: string;
  /**
   * A whole day. With `until`, the last day of a span (a leave from the 2nd to the 6th).
   */
  day?: string;
  /**
   * The last day of a span that started on `day`.
   */
  until?: string;
  starts_at?: string;
  /**
   * When a fact with a moment ends; none for an instant.
   */
  ends_at?: string;
  /**
   * The people of the center it concerns: who meets, who is away, who must do it.
   *
   * @maxItems 50
   */
  person_ids?: string[];
  project_id?: string;
  party_id?: string;
  /**
   * shared (the default): its label is read by whoever may read its project or its people. busy: others see only that the person is taken. private: only the people it concerns see it. An absence is always read without its reason.
   */
  visibility?: 'shared' | 'busy' | 'private';
  /**
   * Where it is read, in the app.
   */
  href?: string;
  /**
   * True takes the fact back.
   */
  cancelled?: boolean;
} & (
  | {
      day: unknown;
      [k: string]: unknown;
    }
  | {
      starts_at: unknown;
      [k: string]: unknown;
    }
);

/**
 * A signed batch of events sent to a receiver.
 */
export interface DeliveryRequest {
  /**
   * @minItems 1
   * @maxItems 100
   */
  events: [KeteEvent, ...KeteEvent[]];
}

/**
 * The receiver's outcome for each event of a batch.
 */
export interface DeliveryResult {
  results: {
    id: string;
    outcome: 'accepted' | 'duplicate' | 'refused';
    reason?:
      | 'invalid_signature'
      | 'stale'
      | 'unknown_product'
      | 'invalid_payload'
      | 'undeclared_type'
      | 'batch_too_large';
  }[];
}

/**
 * The data payload of each standard event type. Facts and counters only; amounts are integers in the currency's smallest unit.
 */
export interface StandardEventData {
  [k: string]: unknown;
}
/**
 * This interface was referenced by `StandardEventData`'s JSON-Schema
 * via the `definition` "AccountCreated".
 */
export interface AccountCreated {
  plan?: string;
}
/**
 * This interface was referenced by `StandardEventData`'s JSON-Schema
 * via the `definition` "AccountActivated".
 */
export interface AccountActivated {
  activation: string;
}
/**
 * This interface was referenced by `StandardEventData`'s JSON-Schema
 * via the `definition` "PaymentSucceeded".
 */
export interface PaymentSucceeded {
  amount: number;
  currency: string;
  reference: string;
}
/**
 * This interface was referenced by `StandardEventData`'s JSON-Schema
 * via the `definition` "PaymentFailed".
 */
export interface PaymentFailed {
  amount: number;
  currency: string;
  reason_code: string;
}
/**
 * This interface was referenced by `StandardEventData`'s JSON-Schema
 * via the `definition` "SubscriptionRenewalDue".
 */
export interface SubscriptionRenewalDue {
  due_on: string;
  plan: string;
}
/**
 * This interface was referenced by `StandardEventData`'s JSON-Schema
 * via the `definition` "AccountClosed".
 */
export interface AccountClosed {
  reason_code?: string;
}
/**
 * This interface was referenced by `StandardEventData`'s JSON-Schema
 * via the `definition` "MetricsDaily".
 */
export interface MetricsDaily {
  day: string;
  counters: {
    [k: string]: number;
  };
}
/**
 * This interface was referenced by `StandardEventData`'s JSON-Schema
 * via the `definition` "DeploymentRequested".
 */
export interface DeploymentRequested {
  deployment_id: string;
  product: string;
  mode: 'shared' | 'dedicated' | 'on_premises' | 'autonomous';
  region: string;
  apps: string[];
}
/**
 * This interface was referenced by `StandardEventData`'s JSON-Schema
 * via the `definition` "DeploymentReady".
 */
export interface DeploymentReady {
  deployment_id: string;
  product: string;
  mode: 'shared' | 'dedicated' | 'on_premises' | 'autonomous';
  url: string;
}

/**
 * An immutable fact announced by a Kete app. Facts and counters only: no names, e-mails or phone numbers.
 */
export interface KeteEvent {
  id: string;
  type: string;
  specversion: '1';
  product: string;
  organization: string;
  occurred_at: string;
  data: {
    [k: string]: unknown;
  };
}

/**
 * A file an app keeps, said to the center with what it proves: the object it is linked to, its role there, its nature and where it came from. The file stays in the app; the center keeps the link, so that search and the assistant find it across Kete, read under the rights of the linked object. Sent again under the same key, it replaces what was said.
 */
export interface FileLink {
  key: string;
  /**
   * The file's name, as shown.
   */
  name: string;
  /**
   * What it is linked to: a record of the app, or a reference of the center.
   */
  object: {
    kind: string;
    id: string;
  };
  /**
   * What it proves there, as a person reads it: « bon de commande signé », « justificatif ».
   */
  role: string;
  nature?:
    | 'receipt'
    | 'supplier_invoice'
    | 'invoice'
    | 'purchase_order'
    | 'contract'
    | 'statement'
    | 'identity'
    | 'photo'
    | 'other';
  origin?: 'whatsapp' | 'telegram' | 'email' | 'upload' | 'generated';
  project_id?: string;
  party_id?: string;
  /**
   * Until when it must be kept (a book-keeping piece: ten years).
   */
  keep_until?: string;
  href?: string;
}

/**
 * A gesture about to be made, by a person or an agent acting for one, as the policy engine reads it before the command runs (doctrine D-058, spec 112): who, what, on what, how much, through which channel, towards whom. The same gesture by a person and by her agent is the same gesture.
 */
export interface Gesture {
  /**
   * Who makes it. An agent always acts for a person.
   */
  actor: {
    kind: 'person' | 'agent';
    id: string;
    /**
     * The person an agent acts for.
     */
    on_behalf_of?: string;
  };
  /**
   * What it does, named by the product: invoice.validate, message.client, purchase.commit, contract.sign, document.read…
   */
  kind: string;
  /**
   * What it acts on: a project, a party, a document, a card.
   */
  object: {
    kind: string;
    id: string;
  };
  /**
   * How much it commits, in the currency's smallest unit.
   */
  amount?: {
    value: number;
    currency: string;
  };
  /**
   * Through which channel it goes out, when it reaches someone: whatsapp, telegram, mail, web.
   */
  channel?: string;
  /**
   * The party outside it reaches, when it does.
   */
  party?: string;
  /**
   * The approved template it uses, when it writes to someone outside.
   */
  template?: string;
  /**
   * What else the product's policies read (an hour, a retention, an absence), flat.
   */
  context?: {
    [k: string]: string | number | boolean;
  };
  /**
   * When it is about to be made.
   */
  at: string;
}

/**
 * A Kete app's health, served at GET /health. Never exposes secrets or connection strings.
 */
export interface HealthReport {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  checked_at: string;
  dependencies: {
    name: string;
    status: 'up' | 'down';
    latency_ms?: number;
  }[];
  outbox: {
    pending: number;
    oldest_pending_age_seconds?: number;
  };
}

/**
 * A thing in progress and who holds it (doctrine D-056, spec 111): a request, a step of a circuit, a draft to check, an action from a meeting, an agent's task. It always has a holder — a person or an agent — and may wait on someone. An app says it under its source; said again under the same source, it replaces what was said. The center gives it its id.
 */
export interface Holding {
  /**
   * Given by the center when it keeps the holding; absent when an app says it.
   */
  id?: string;
  /**
   * Where it comes from: one holding per app, kind and reference.
   */
  source: {
    app: string;
    /**
     * What it is in that app: request, todo, meeting_action, circuit_step, draft, agent_task…
     */
    kind: string;
    ref: string;
  };
  /**
   * What it is about: a project, a party, a quote, a ticket, an asset.
   */
  object: {
    kind: string;
    id: string;
  };
  /**
   * What is to be done, as a person reads it: « Chiffrer le devis Garage Bè ».
   */
  what: string;
  /**
   * Who holds it now. Never nobody.
   */
  holder: {
    kind: 'person' | 'agent';
    id: string;
  };
  /**
   * Who it waits for: a colleague, an agent, a party outside; none when it is in the holder's hands.
   */
  waiting_on?: {
    kind: 'person' | 'agent' | 'party';
    id: string;
  } | null;
  /**
   * Since when it is in progress.
   */
  since?: string;
  /**
   * The day it is due, in the organization's time.
   */
  due?: string;
  /**
   * held: in the holder's hands. waiting: it waits on someone. done: finished.
   */
  state: 'held' | 'waiting' | 'done';
  /**
   * Where it opens: an https address of the app that says it, or a path of the center. Absent: the center finds its way from the source.
   */
  href?: string;
  /**
   * action: the holder must act. information: the holder is told, nothing more.
   */
  for?: 'action' | 'information';
}

/**
 * One event of a Kete Intelligence turn, streamed from the agents' runtime to the screen: what it is doing now, its plan and each step, each tool it calls with its level, a draft for the person, a source, the answer's text as it is written, a wait for the person, the end or the failure. The same stream is shown in the center and in every app.
 */
export type IntelligenceEvent =
  | IntelligenceStatus
  | IntelligencePlan
  | IntelligenceStep
  | IntelligenceTool
  | IntelligenceDraft
  | IntelligenceSource
  | IntelligenceText
  | IntelligenceWaiting
  | IntelligenceDone
  | IntelligenceFailed;

/**
 * What it is doing at this instant, in a sentence.
 */
export interface IntelligenceStatus {
  type: 'status';
  text: string;
}
/**
 * The steps it intends to take, shown before it acts.
 */
export interface IntelligencePlan {
  type: 'plan';
  /**
   * @minItems 1
   * @maxItems 20
   */
  steps:
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ];
}
export interface IntelligenceStep {
  type: 'step';
  index: number;
  state: 'running' | 'done' | 'skipped';
}
/**
 * A capability it calls, with its autonomy level and what it gave back, in short.
 */
export interface IntelligenceTool {
  type: 'tool';
  id: string;
  name: string;
  level: number;
  state: 'running' | 'done' | 'failed';
  input?: string;
  summary?: string;
}
/**
 * A draft prepared for the person, decided in place.
 */
export interface IntelligenceDraft {
  type: 'draft';
  draft_id: string;
  title: string;
  /**
   * Where it is opened: an address of the product, relative to its own screens, or absolute.
   */
  href?: string;
}
/**
 * What the answer rests on, opened by a click.
 */
export interface IntelligenceSource {
  type: 'source';
  label: string;
  /**
   * Where it is opened: an address of the product, relative to its own screens, or absolute.
   */
  href?: string;
}
/**
 * A piece of the answer as it is written.
 */
export interface IntelligenceText {
  type: 'text';
  delta: string;
}
/**
 * It stops until the person answers or decides.
 */
export interface IntelligenceWaiting {
  type: 'waiting';
  reason: string;
}
export interface IntelligenceDone {
  type: 'done';
  steps?: number;
  tools?: number;
  ms?: number;
}
/**
 * It stopped; what was read is kept, nothing was changed by the failure.
 */
export interface IntelligenceFailed {
  type: 'failed';
  reason: string;
}

/**
 * What the use of a resource taught: a correction, a note, a gap an agent saw. Gathered with consent, it is data, never an instruction; its owner keeps it — it becomes a test case — or drops it (doctrine D-053).
 */
export interface Lesson {
  id: string;
  resource: {
    kind: 'skill' | 'agent' | 'app';
    id: string;
  };
  /**
   * correction: a person corrected a draft. note: a person noted it. agent: an agent saw a gap.
   */
  source: 'correction' | 'note' | 'agent';
  /**
   * What was seen, as said.
   */
  observed: string;
  /**
   * What could change in the resource.
   */
  proposal?: string;
  /**
   * The situation it came from, which becomes a test case if kept.
   */
  case?: string;
  /**
   * The person agreed to share it; nothing confidential travels unless generalized.
   */
  consent: true;
  state: 'waiting' | 'kept' | 'dropped';
}

/**
 * A Kete app's self-description, served at GET /.well-known/kete.
 */
export interface Manifest {
  product: string;
  name: string;
  version: string;
  environment: 'production' | 'staging' | 'preview' | 'development';
  events: string[];
  /**
   * What the app exposes to agents (optional, added in v1: additive).
   */
  capabilities?: Capability[];
  /**
   * The data sets the app exposes, read at its API under the reader's rights (optional, added in v1: additive).
   */
  datasets?: Dataset[];
  /**
   * Where agents and other apps reach the app (optional, added in v1: additive): its MCP server and its API.
   */
  endpoints?: {
    mcp?: string;
    api?: string;
  };
  /**
   * The app's client id at the Compte Kete (optional, added in v1: additive; spec 049): a center accepts the app's own tokens for an organization whose registry holds it.
   */
  client?: string;
  /**
   * The permissions the app checks (optional, added in v1: additive; spec 049), each with its words for people and the Compte Kete roles that hold it by default. A center lets an administrator grant them to roles and positions.
   */
  permissions?: {
    name: string;
    label: {
      fr: string;
      en: string;
    };
    description?: {
      fr: string;
      en: string;
    };
    roles: ('owner' | 'admin' | 'member')[];
  }[];
  /**
   * The business events the app announces (optional, added in v1: additive; spec 049): identifiers and facts only, the rest read at its API under the reader's rights.
   */
  emits?: {
    type: string;
    description: string;
    /**
     * How far the data may travel. public: anyone; internal (the default): the organization's people with the permission; confidential: a need to know, never in a shared briefing; secret: never sent to a model, a shared briefing nor a notification's text.
     */
    classification?: 'public' | 'internal' | 'confidential' | 'secret';
    /**
     * The JSON Schema of the event's data.
     */
    data?: {
      [k: string]: unknown;
    };
  }[];
  /**
   * What the app asks a center to decide (optional, added in v1: additive; spec 049): a purchase, a leave. The center's circuits find the approver.
   */
  subjects?: {
    name: string;
    label: {
      fr: string;
      en: string;
    };
    measure?: {
      fr: string;
      en: string;
    };
  }[];
  links?: {
    repository?: string;
    documentation?: string;
  };
  /**
   * The app's identity card (optional, added in v1: additive; doctrine D-040): who answers for it, what data it handles, whether it uses AI, and what an outage costs. A registry deduces from it the controls that apply.
   */
  governance?: {
    /**
     * The person or team that answers for the app.
     */
    owner: {
      name: string;
      contact?: string;
    };
    /**
     * The kinds of data the app handles. personal: about an identifiable person; special: health, biometrics, beliefs, origin and other sensitive personal data; children: about minors; financial: amounts, accounts, invoices; payment: payment instruments; location: where someone is; credentials: secrets that open access; confidential: business data not meant to leave the organization; none: none of these.
     *
     * @minItems 1
     */
    dataCategories: [
      (
        | 'none'
        | 'personal'
        | 'special'
        | 'children'
        | 'financial'
        | 'payment'
        | 'location'
        | 'credentials'
        | 'confidential'
      ),
      ...(
        | 'none'
        | 'personal'
        | 'special'
        | 'children'
        | 'financial'
        | 'payment'
        | 'location'
        | 'credentials'
        | 'confidential'
      )[],
    ];
    /**
     * Whether the app calls AI models itself (its capabilities, used by agents, are listed apart).
     */
    ai: {
      used: boolean;
      purpose?: string;
    };
    /**
     * What an outage costs. low: an inconvenience; medium: work slows down; high: work stops or money is lost; critical: safety, legal obligations, or every customer at once.
     */
    criticality: 'low' | 'medium' | 'high' | 'critical';
  };
  /**
   * The question the app answers on its home (optional, added in v1: additive; doctrine D-048): « Combien ai-je vraiment, projet par projet ? ».
   */
  question?: {
    fr: string;
    en: string;
  };
  /**
   * The places of the app, in the order of its sidebar (optional, added in v1: additive; spec 099). A center or the shell builds the menu and Ctrl K from them; each is opened at the app's address followed by its path.
   *
   * @maxItems 40
   */
  places?: {
    id: string;
    label: {
      fr: string;
      en: string;
    };
    path: string;
    /**
     * The heading the place sits under.
     */
    section?: {
      fr: string;
      en: string;
    };
    /**
     * A name of the design's icon set.
     */
    icon?: string;
    /**
     * Shown only to who holds it.
     */
    permission?: string;
  }[];
  /**
   * The figures the app declares (optional, added in v1: additive; spec 099), read at its API under the reader's rights.
   */
  metrics?: Metric[];
}

/**
 * One thing said in a thread (doctrine D-057), by a person, an agent, or a contact through a channel. Never rewritten: an edit is a new message naming the one it replaces. « for action » asks someone to act and becomes a holding; « for information » tells.
 */
export interface Message {
  id: string;
  thread: string;
  author: {
    kind: 'person' | 'agent' | 'contact';
    id: string;
  };
  text: string;
  /**
   * @maxItems 20
   */
  attachments?:
    | []
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ]
    | [
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
        {
          /**
           * The file kept in the product's storage.
           */
          id: string;
          name: string;
          media_type?: string;
          bytes?: number;
        },
      ];
  for: 'action' | 'information';
  /**
   * Who must act, for a message « for action »; the thread's holder otherwise.
   */
  to?: {
    kind: 'person' | 'agent';
    id: string;
  };
  via: 'kete' | 'whatsapp' | 'mail' | 'telegram' | 'form';
  reply_to?: string;
  /**
   * The message this one replaces; the original is kept.
   */
  edited_from?: string;
  /**
   * @maxItems 50
   */
  mentions?: {
    kind: 'person' | 'agent';
    id: string;
  }[];
  at: string;
}

/**
 * A figure an app declared (metric.v1), read at a moment for a reader, under her rights (doctrine D-052): its value over a period, the value of the period before when she compares, and the filters it applied. A board, an app's home and a summary show readings; a summary keeps them frozen.
 */
export interface MetricReading {
  /**
   * The metric's name, as its app declares it: « finance.available ».
   */
  name: string;
  /**
   * In the metric's unit; money in the currency's smallest unit. Null: nothing to count, or the reader may not read it (`denied`).
   */
  value: number | null;
  /**
   * The value over the period just before, of the same length, when the reader compares.
   */
  previous?: number | null;
  /**
   * For a metric in money: ISO 4217.
   */
  currency?: string;
  /**
   * The days it covers, both included; none for « everything ».
   */
  period?: {
    from: string;
    to: string;
  };
  /**
   * The filters it applied — only those on its axes; a filter asked on another axis is left out, and the reader is told the figure is not filtered.
   */
  filter?: {
    project_id?: string;
    party_id?: string;
    person_id?: string;
  };
  /**
   * When it was read.
   */
  at: string;
  /**
   * True: the reader may not read this figure; its value is null.
   */
  denied?: boolean;
}

/**
 * A figure an app declares in its manifest, computed by the app's code and read under the reader's rights (doctrine D-052). Boards, the apps' homes and summaries compose metrics; no one writes a query. Its axes are the center's references, so that a filter « project = X » applies to every app's figures at once.
 */
export interface Metric {
  /**
   * The app's area, then the figure: « finance.available », « team.absences ».
   */
  name: string;
  label: {
    fr: string;
    en: string;
  };
  /**
   * How it is computed, in a sentence a person reads beside « Pourquoi ? ».
   */
  description?: {
    fr: string;
    en: string;
  };
  /**
   * money: in the currency's smallest unit, with its currency. count, days, hours, percent: plain numbers.
   */
  unit: 'money' | 'count' | 'days' | 'hours' | 'percent';
  /**
   * Whether a rise is good news (up), bad news (down), or neither (none).
   */
  better: 'up' | 'down' | 'none';
  /**
   * What it can be split or filtered by.
   */
  axes?: ('project' | 'party' | 'person' | 'period')[];
}

/**
 * A fact of money an app says to its center, with the token of the person who made it true. Sent again under the same key, it replaces what was said: an app keeps the amount of an invoice at what is still due, and of a commitment at what is still to pay. The center adds the facts up by project; it executes no payment and keeps no ledger.
 */
export interface MoneyFact {
  /**
   * The app's own key for this fact: one fact per app and key.
   */
  key: string;
  /**
   * invoiced: asked of a third party and still due. received: money that came in. committed: promised to a third party and still to pay (an order placed, a pay due). spent: money that went out.
   */
  kind: 'invoiced' | 'received' | 'committed' | 'spent';
  /**
   * In the currency's smallest unit (francs for XOF, cents for EUR): an integer, never negative.
   */
  amount: number;
  /**
   * ISO 4217.
   */
  currency: string;
  /**
   * The day it became true.
   */
  occurred_on: string;
  /**
   * What it is, as a person reads it: « Facture F-0412 », « Bon de commande BC-0031 ».
   */
  label: string;
  /**
   * The project of the center it belongs to; none for the organization's own running.
   */
  project_id?: string;
  /**
   * The post of the project's budget it counts against, by its name.
   */
  post?: string;
  /**
   * The third party of the center it concerns.
   */
  party_id?: string;
  /**
   * Where the piece that proves it is read, in the app.
   */
  href?: string;
}

/**
 * What the policy engine decided for a gesture (doctrine D-058, spec 112): allowed, to approve by someone, or refused — with the policies that decided it, their versions and why. A refusal wins over an approval, an approval over an allowance. What the policies on trial would have said is kept beside, never enforced.
 */
export interface PolicyDecision {
  effect: 'allow' | 'approve' | 'refuse';
  /**
   * Who must approve, when the effect is approve: the relations or roles of the policies that asked.
   */
  approvers?: string[];
  /**
   * The policies that decided. Empty for a refusal means nothing gave the power.
   */
  policies: {
    id: string;
    version: number;
    effect: 'allow' | 'approve' | 'refuse';
    /**
     * The policy's sentence, as the person reads it on the card.
     */
    reason: string;
  }[];
  /**
   * The policies on trial that would have refused or asked, had they been active.
   */
  trial: {
    id: string;
    version: number;
    effect: 'allow' | 'approve' | 'refuse';
    /**
     * The policy's sentence, as the person reads it on the card.
     */
    reason: string;
  }[];
}

/**
 * A rule of the organization, written as a sentence by a person and kept as a Cedar rule (doctrine D-058, spec 112). It decides what may be done at all (authority), or what needs someone's approval (approval). A new one observes first (trial): its decisions are journaled, never enforced. Each change is a new version.
 */
export interface Policy {
  id: string;
  /**
   * The policy as the organization says it: « Un agent n'écrit pas aux clients après 19 h ».
   */
  sentence: string;
  /**
   * Its Cedar rule: one permit or forbid.
   */
  rule: string;
  /**
   * authority: a forbid refuses, a permit allows. approval: a permit means the gesture needs the approver's approval.
   */
  set: 'authority' | 'approval';
  /**
   * Who approves, for an approval policy: a relation or a role the product resolves (manager, project.holder, direction, on_behalf_of).
   */
  approver?: string;
  /**
   * Who answers for it: a person's id.
   */
  owner: string;
  version: number;
  /**
   * active: enforced. trial: observed, never enforced. off: kept, not read.
   */
  status: 'active' | 'trial' | 'off';
}

/**
 * Several things an agent proposes at once — the evening's tidying, a week's plan, what a document said — each ticked or not by the person, applied together by one gesture, and undone together (doctrine D-051). Nothing in it is true until applied: each item names the gesture that will make it true, with its level.
 */
export interface ProposalSet {
  id: string;
  /**
   * closure: the evening's note. plan: a plan of the day or the week. intake: what was received. agent: an agent's run.
   */
  origin: 'closure' | 'plan' | 'intake' | 'agent';
  /**
   * The person who decides.
   */
  for: string;
  /**
   * @minItems 1
   * @maxItems 30
   */
  items: [
    {
      key: string;
      /**
       * postpone, close, block (a time), assign (to a colleague, who may refuse), correct (a record), remind, lesson (proposed to a skill's owner), create.
       */
      gesture:
        'postpone' | 'close' | 'block' | 'assign' | 'correct' | 'remind' | 'lesson' | 'create';
      /**
       * What will happen, as the person reads it.
       */
      label: string;
      /**
       * Why it is proposed, in a sentence.
       */
      reason?: string;
      /**
       * The autonomy level of the gesture that applies it (1 to 4).
       */
      level: number;
      /**
       * The capability that applies it, when an app does.
       */
      capability?: string;
      /**
       * Whether it is ticked when shown; the person changes it.
       */
      ticked?: boolean;
      /**
       * What the capability is called with, once applied (optional, added in v1: additive; spec 104).
       */
      input?: {
        [k: string]: unknown;
      };
    },
    ...{
      key: string;
      /**
       * postpone, close, block (a time), assign (to a colleague, who may refuse), correct (a record), remind, lesson (proposed to a skill's owner), create.
       */
      gesture:
        'postpone' | 'close' | 'block' | 'assign' | 'correct' | 'remind' | 'lesson' | 'create';
      /**
       * What will happen, as the person reads it.
       */
      label: string;
      /**
       * Why it is proposed, in a sentence.
       */
      reason?: string;
      /**
       * The autonomy level of the gesture that applies it (1 to 4).
       */
      level: number;
      /**
       * The capability that applies it, when an app does.
       */
      capability?: string;
      /**
       * Whether it is ticked when shown; the person changes it.
       */
      ticked?: boolean;
      /**
       * What the capability is called with, once applied (optional, added in v1: additive; spec 104).
       */
      input?: {
        [k: string]: unknown;
      };
    }[],
  ];
}

/**
 * A skill, an agent or an app in its lifecycle: created, used, learning, evaluated, promoted one tier at a time with a review by its risk (doctrine D-053).
 */
export interface Resource {
  kind: 'skill' | 'agent' | 'app';
  id: string;
  name: string;
  /**
   * The person who owns it and keeps or drops its lessons.
   */
  owner: string;
  version: string;
  /**
   * Who may use it: me, my team, my unit, the whole organization.
   */
  tier: 'me' | 'team' | 'unit' | 'organization';
  /**
   * The review asked to reach the next tier.
   */
  review?: {
    state: 'asked' | 'approved' | 'refused';
    risk: 'low' | 'medium' | 'high';
    /**
     * The role that reviews.
     */
    by?: string;
  };
  /**
   * Its test cases, and how many the current version passes.
   */
  cases?: {
    total: number;
    passed: number;
  };
}

/**
 * Where the router tied something received from outside (doctrine D-056): its object, its thread, the holding it made — by a rule, by the model's intent with its confidence, or by a person. Under the threshold it is not guessed: a card « à classer » asks a person.
 */
export interface Routing {
  /**
   * What was received: its channel and its own reference there.
   */
  received: {
    via: 'whatsapp' | 'mail' | 'telegram' | 'form';
    ref: string;
  };
  object?: {
    kind: string;
    id: string;
  };
  thread?: string;
  holding?: string;
  /**
   * What it is about, in the product's words: incident, quote_request, invoice_request…
   */
  intent: string;
  confidence: number;
  /**
   * rule: a known number, address or thread. model: its intent above the threshold. person: a card « à classer » settled.
   */
  by: 'rule' | 'model' | 'person';
  /**
   * The holding of the card « à classer », when a person must decide.
   */
  asked?: string;
}

/**
 * Where people talk about one thing (doctrine D-056, D-057): born with its object and put away when it closes, a group from the structure or created, a direct exchange, or a person's thread with Kete. It always has a holder; its members say who knew, and since when.
 */
export interface Thread {
  id: string;
  /**
   * object: born with its object. group: a unit, a project's team, a board, or created. direct: between two. kete: a person and Kete Intelligence.
   */
  kind: 'object' | 'group' | 'direct' | 'kete';
  /**
   * What the thread is about; required for an object thread.
   */
  object?: {
    kind: string;
    id: string;
  };
  title: string;
  holder: {
    kind: 'person' | 'agent';
    id: string;
  };
  /**
   * @maxItems 500
   */
  members?: {
    /**
     * contact: someone outside, reached through a channel.
     */
    kind: 'person' | 'agent' | 'contact';
    id: string;
    /**
     * member: takes part. subscriber: is told, follows.
     */
    role?: 'member' | 'subscriber';
    since: string;
    until?: string;
  }[];
  /**
   * Its own address for replies by mail.
   */
  address?: string;
  /**
   * The policy that keeps or puts it away.
   */
  retention?: string;
  state: 'open' | 'closed';
  opened_at: string;
  closed_at?: string;
}
