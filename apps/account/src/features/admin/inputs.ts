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
