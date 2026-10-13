import { z } from 'zod';

// Spec 007: what Kete Cockpit sends to change the offers catalog. Pure schemas, shared by the API
// and its description.

export const offerInput = z.object({
  app: z.enum(['firmo', 'nettio', 'nyatefe', 'cockpit']),
  productId: z.string().min(1).max(128),
  periodDays: z.number().int().min(1).max(366),
  graceDays: z.number().int().min(0).max(30).default(3),
  name: z.string().trim().min(1).max(120).optional(),
});

export const disableOfferInput = z.object({ productId: z.string().min(1).max(128) });

/** What an offer allows (spec 092): a limit not given is no limit. */
export const limitsInput = z
  .object({
    people: z.number().int().min(0).max(1_000_000),
    ai_tokens_month: z.number().int().min(0).max(1_000_000_000_000),
    storage_mb: z.number().int().min(0).max(100_000_000),
    connected_apps: z.number().int().min(0).max(10_000),
    agents: z.number().int().min(0).max(100_000),
  })
  .partial()
  .strict();

/** The terms of an offer already in the catalog: what it allows, how long it stays readable. */
export const offerTermsInput = z.object({
  productId: z.string().min(1).max(128),
  limits: limitsInput.default({}),
  readDays: z.number().int().min(0).max(3650).default(90),
});

/** An app's free trial: once per organization, for a number of days, with its limits. */
export const trialInput = z.object({
  app: z.enum(['firmo', 'nettio', 'nyatefe', 'cockpit']),
  days: z.number().int().min(1).max(90),
  name: z.string().trim().min(1).max(120),
  limits: limitsInput.default({}),
  readDays: z.number().int().min(0).max(3650).default(90),
});
