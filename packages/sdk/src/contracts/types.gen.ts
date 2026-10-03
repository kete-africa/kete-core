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
}

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
}
