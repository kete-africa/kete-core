import { z } from 'zod';

/**
 * What Kete Enterprise sends once IT approved a person's request (spec 048): who asks, in which
 * organization, and the app's identity card — the same words as the template's `kete.json`.
 */
export const appRequest = z.object({
  requestId: z.string().regex(/^apr_[0-9a-z-]{8,64}$/),
  organizationId: z.string().regex(/^org_[\w-]{4,64}$/),
  requester: z.object({
    userId: z.string().min(1).max(128),
    name: z.string().trim().min(1).max(160),
    email: z.string().email().optional(),
  }),
  app: z.object({
    /** English, kebab-case: `fieldwork` gives the repository `kete-fieldwork`. */
    slug: z.string().regex(/^[a-z][a-z0-9-]{2,30}$/),
    name: z.string().trim().min(1).max(80),
    purpose: z.string().trim().min(20).max(4000),
    users: z.string().trim().min(1).max(1000),
    dataCategories: z
      .array(
        z.enum([
          'none',
          'personal',
          'special',
          'children',
          'financial',
          'payment',
          'location',
          'credentials',
          'confidential',
        ]),
      )
      .min(1),
    criticality: z.enum(['low', 'medium', 'high', 'critical']),
    ownerContact: z.string().email(),
  }),
  /** Where the factory reports each step, signed. */
  callbackUrl: z.string().url().startsWith('https://'),
});

export type AppRequest = z.infer<typeof appRequest>;

/** The steps of a request, in order; each one is done once, even if the job runs again. */
export const steps = [
  'repository',
  'scaffold',
  'secrets',
  'database',
  'sign-in',
  'hosting',
  'deploy',
  'live',
  'coding',
  'pull-request',
] as const;

export type Step = (typeof steps)[number];

export type RequestStatus = 'queued' | 'building' | 'ready' | 'coding' | 'review' | 'failed';

/** What a request has produced so far: no secret is ever kept here. */
export interface Progress {
  done: Step[];
  repository?: string;
  url?: string;
  hostingId?: string;
  clientId?: string;
  pullRequest?: string;
  sandboxId?: string;
  /** How many times the app was found not answering yet, after its deploy. */
  probes?: number;
  error?: string;
}
