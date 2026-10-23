import { describe, expect, it } from 'vitest';
import {
  allows,
  defaultGrants,
  grantsOf,
  newWebhookSecret,
  signWebhook,
  verifyWebhook,
} from '../src/index.js';

// Spec 147 (ADR 0019; D-062, R8): one connection, three uses kept apart — read at connection, act
// tool by tool at a level never alone, signal by choice — and its webhook signed with its secret.

describe('the three grants', () => {
  it('reads when connected, and does nothing else until granted', () => {
    const grants = defaultGrants();
    expect(allows(grants, 'read', 'invoices_list')).toEqual({ allowed: true, level: null });
    expect(allows(grants, 'act', 'invoice_send')).toEqual({ allowed: false });
    expect(allows(grants, 'signal', 'purchase_requests')).toEqual({ allowed: false });
  });

  it('acts tool by tool at its level, never above « prepare »', () => {
    const grants = grantsOf({ read: true, act: { invoice_draft: 3, tag_add: 2, pay: 4 } });
    expect(allows(grants, 'act', 'invoice_draft')).toEqual({ allowed: true, level: 3 });
    expect(allows(grants, 'act', 'tag_add')).toEqual({ allowed: true, level: 2 });
    // A level 4 kept by mistake is not understood: paying comes back to a person.
    expect(allows(grants, 'act', 'pay')).toEqual({ allowed: false });
  });

  it('signals what was chosen; what is not understood grants nothing', () => {
    expect(
      allows(grantsOf({ signal: ['purchase_requests'] }), 'signal', 'purchase_requests'),
    ).toEqual({
      allowed: true,
      level: null,
    });
    expect(grantsOf('everything')).toEqual({ read: false, act: {}, signal: [] });
  });
});

describe('a webhook', () => {
  it('is accepted with its signature, refused with another or none', () => {
    const secret = newWebhookSecret();
    const body = JSON.stringify({ type: 'invoice.overdue', id: 'F-2026-0004' });
    expect(verifyWebhook(secret, body, signWebhook(secret, body))).toBe(true);
    expect(verifyWebhook(secret, `${body} `, signWebhook(secret, body))).toBe(false);
    expect(verifyWebhook(newWebhookSecret(), body, signWebhook(secret, body))).toBe(false);
    expect(verifyWebhook(secret, body, null)).toBe(false);
  });
});
