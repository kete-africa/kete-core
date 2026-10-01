import { z } from 'zod';

// Spec 013: what a trusted Kete app sends. Pure schemas, shared by the API and its description.

const e164 = z.string().regex(/^\+[1-9]\d{7,14}$/, 'an E.164 phone number');

export const personInput = z.object({
  phoneNumber: e164,
  name: z.string().trim().min(1).max(200).nullish(),
  organizationName: z.string().trim().min(1).max(200).nullish(),
});

export const signInLinkInput = z.object({
  personId: z.string().min(1).max(100),
  returnTo: z.url().max(2000),
});
