import type {
  AccountActivated,
  AccountClosed,
  AccountCreated,
  MetricsDaily,
  PaymentFailed,
  PaymentSucceeded,
  SubscriptionRenewalDue,
} from '../contracts/types.gen.js';

/** The standard event types (FR-005) and the event-data.v1 definition of their payload. */
export const standardEventTypes = {
  'account.created': 'AccountCreated',
  'account.activated': 'AccountActivated',
  'payment.succeeded': 'PaymentSucceeded',
  'payment.failed': 'PaymentFailed',
  'subscription.renewal_due': 'SubscriptionRenewalDue',
  'account.closed': 'AccountClosed',
  'metrics.daily': 'MetricsDaily',
} as const;

export type StandardEventType = keyof typeof standardEventTypes;

export interface StandardEventDataMap {
  'account.created': AccountCreated;
  'account.activated': AccountActivated;
  'payment.succeeded': PaymentSucceeded;
  'payment.failed': PaymentFailed;
  'subscription.renewal_due': SubscriptionRenewalDue;
  'account.closed': AccountClosed;
  'metrics.daily': MetricsDaily;
}

export function isStandardEventType(type: string): type is StandardEventType {
  return Object.hasOwn(standardEventTypes, type);
}
