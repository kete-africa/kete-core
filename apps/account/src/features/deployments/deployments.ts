import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { type Actor, canAdminister, ForbiddenError, requireMember } from '@/platform/actor';
import { accountEvent, record } from '@/platform/events';
import { prefixedId } from '@/platform/ids';
import { deployments, type DeploymentMode } from '@/platform/schema';
import { inOrganization } from '@/platform/tenancy';

// An organization deploys its Kete itself (spec 123; phase 11, step B3; doctrine D-059): it
// chooses how it runs — shared, dedicated, at its own place, or on its own — its region and the
// apps beside it. Shared is ready at once, with no gesture of Kete's; the other modes are requests
// that Kete's fleet (the Cockpit, step B2) makes, heard through `deployment.requested`.

export const ENTERPRISE = 'prd_kete_enterprise';

/** The apps an organization may put beside its Kete Enterprise. */
export const DEPLOYABLE_APPS = [
  'prd_kete_finance',
  'prd_kete_team',
  'prd_kete_commitments',
  'prd_kete_helpdesk',
] as const;

export const MODES = ['shared', 'dedicated', 'on_premises', 'autonomous'] as const;

export interface Region {
  id: string;
  label: { fr: string; en: string };
}

/**
 * The regions Kete deploys in (`KETE_DEPLOY_REGIONS`, a JSON list of `{ id, label: { fr, en } }`);
 * without it, Kete's own region alone.
 */
export function deployRegions(env: NodeJS.ProcessEnv = process.env): Region[] {
  const fallback: Region[] = [
    { id: 'kete', label: { fr: 'La région de Kete', en: 'Kete’s region' } },
  ];
  try {
    const parsed = z
      .array(
        z.object({
          id: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/),
          label: z.object({ fr: z.string().min(1).max(80), en: z.string().min(1).max(80) }),
        }),
      )
      .min(1)
      .safeParse(JSON.parse(env.KETE_DEPLOY_REGIONS ?? 'null'));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

/** The shared Kete Enterprise every organization may use at once (`KETE_ENTERPRISE_URL`). */
export function sharedUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const url = (env.KETE_ENTERPRISE_URL ?? '').trim().replace(/\/$/, '');
  return /^https?:\/\//.test(url) ? url : null;
}

export const deployInput = z.object({
  mode: z.enum(MODES),
  region: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/),
  apps: z.array(z.enum(DEPLOYABLE_APPS)).max(DEPLOYABLE_APPS.length).default([]),
});
export type DeployInput = z.input<typeof deployInput>;

export class DeploymentError extends Error {
  constructor(
    readonly code: 'unknown_region' | 'shared_unavailable' | 'already_requested' | 'same_mode',
  ) {
    super(code);
    this.name = 'DeploymentError';
  }
}

export interface DeploymentView {
  id: string;
  mode: DeploymentMode;
  region: string;
  apps: string[];
  status: 'requested' | 'ready';
  url: string | null;
  requestedMode: DeploymentMode | null;
  createdAt: string;
}

const viewOf = (row: typeof deployments.$inferSelect): DeploymentView => ({
  id: row.id,
  mode: row.mode,
  region: row.region,
  apps: row.apps,
  status: row.status,
  url: row.url,
  requestedMode: row.requestedMode,
  createdAt: row.createdAt.toISOString(),
});

/** The organization's Kete Enterprise, if it deployed it. */
export async function deploymentOf(organizationId: string): Promise<DeploymentView | null> {
  const [row] = await inOrganization(organizationId, (tx) =>
    tx.select().from(deployments).where(eq(deployments.product, ENTERPRISE)),
  );
  return row ? viewOf(row) : null;
}

/**
 * Deploys the organization's Kete Enterprise — its owner or an administrator only. Shared: ready
 * at once at the shared address. Another mode: a request for Kete's fleet. Once one runs, asking
 * another mode records it beside the running one.
 */
export async function deploy(
  actor: Actor | null,
  input: DeployInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DeploymentView> {
  const me = requireMember(actor);
  if (!canAdminister(me.role)) throw new ForbiddenError('forbidden');
  const value = deployInput.parse(input);
  if (!deployRegions(env).some((region) => region.id === value.region)) {
    throw new DeploymentError('unknown_region');
  }
  const shared = sharedUrl(env);
  if (value.mode === 'shared' && !shared) throw new DeploymentError('shared_unavailable');
  const now = new Date();

  return inOrganization(me.organizationId, async (tx) => {
    const [current] = await tx
      .select()
      .from(deployments)
      .where(eq(deployments.product, ENTERPRISE))
      .for('update');
    const requested = (id: string) =>
      record(
        tx,
        accountEvent('deployment.requested', me.organizationId, {
          deployment_id: id,
          product: ENTERPRISE,
          mode: value.mode,
          region: value.region,
          apps: value.apps,
        }),
      );

    if (current) {
      if (current.status === 'requested') throw new DeploymentError('already_requested');
      if (current.mode === value.mode) throw new DeploymentError('same_mode');
      if (current.requestedMode) throw new DeploymentError('already_requested');
      const [row] = await tx
        .update(deployments)
        .set({ requestedMode: value.mode, updatedAt: now })
        .where(eq(deployments.id, current.id))
        .returning();
      await requested(current.id);
      return viewOf(row as typeof deployments.$inferSelect);
    }

    const id = prefixedId('deployment');
    const ready = value.mode === 'shared';
    const [row] = await tx
      .insert(deployments)
      .values({
        id,
        organizationId: me.organizationId,
        product: ENTERPRISE,
        mode: value.mode,
        region: value.region,
        apps: value.apps,
        status: ready ? 'ready' : 'requested',
        url: ready ? shared : null,
        requestedBy: me.userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await requested(id);
    if (ready && shared) {
      await record(
        tx,
        accountEvent('deployment.ready', me.organizationId, {
          deployment_id: id,
          product: ENTERPRISE,
          mode: 'shared',
          url: shared,
        }),
      );
    }
    return viewOf(row as typeof deployments.$inferSelect);
  });
}
