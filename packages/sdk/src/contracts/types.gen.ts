// Generated from /contracts by `pnpm contracts:generate`. Do not edit.
/* eslint-disable */

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
  links?: {
    repository?: string;
    documentation?: string;
  };
}
