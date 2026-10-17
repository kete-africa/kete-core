import { z } from 'zod';

/** An operator's word that a deployment is made, at its https address (spec 125). */
export const makeReadyInput = z.object({
  deploymentId: z.string().min(4).max(64),
  url: z
    .string()
    .url()
    .max(300)
    .refine((value) => value.startsWith('https://'), 'An https address.'),
});
