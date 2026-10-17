import { runOperatorGesture, type OperatorGesture } from '@kete/admin';
import { defineCommand } from '@kete/commands';
import { recordEvent, setOrganization } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { inOrganizationTx, sqlExecutorOf } from '@kete/tenancy/drizzle';
import { sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '@/platform/db';
import { accountEvent } from '@/platform/events';
import type { DeploymentMode } from '@/platform/schema';
import { makeReadyInput } from './inputs';

// Kete's fleet (spec 125; phase 11, step B2), from Kete Cockpit: every organization's deployment
// requests, read across organizations by the owner's function; and an operator's word that one is
// made — at its address — journaled in Kete's organization, written and announced in the client's.

/** A deployment Kete cannot make: none such, or nothing left to make. */
export class FleetError extends Error {
  constructor(
    readonly status: 404 | 409,
    readonly code: 'not_found' | 'nothing_to_make',
  ) {
    super(code);
    this.name = 'FleetError';
  }
}

export interface FleetDeployment {
  id: string;
  organizationId: string;
  organizationName: string;
  product: string;
  mode: DeploymentMode;
  region: string;
  apps: string[];
  status: 'requested' | 'ready';
  url: string | null;
  requestedMode: DeploymentMode | null;
  createdAt: string;
  updatedAt: string;
}

/** The fleet's deployments: what waits for Kete first, then the latest. */
export async function readFleet(): Promise<FleetDeployment[]> {
  const { rows } = await db.execute<{
    id: string;
    organization_id: string;
    organization_name: string;
    product: string;
    mode: DeploymentMode;
    region: string;
    apps: string[];
    status: 'requested' | 'ready';
    url: string | null;
    requested_mode: DeploymentMode | null;
    created_at: Date | string;
    updated_at: Date | string;
  }>(sql`select * from admin_deployments()`);
  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    organizationName: r.organization_name,
    product: r.product,
    mode: r.mode,
    region: r.region,
    apps: r.apps,
    status: r.status,
    url: r.url,
    requestedMode: r.requested_mode,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

export { makeReadyInput };

/**
 * Says a deployment is made, at its address: a request becomes ready; a running one asked in
 * another mode moves to it. Its organization hears `deployment.ready`.
 */
const makeDeploymentReady = defineCommand({
  name: 'make-deployment-ready',
  input: makeReadyInput,
  reversibility: { reversible: false },
  async handler({ deploymentId, url }, { db: tx, organizationId: operators }) {
    const { rows: found } = await tx.query<{ organization: string | null }>(
      `select admin_deployment_organization($1) as organization`,
      [deploymentId],
    );
    const organization = found[0]?.organization;
    if (!organization) throw new FleetError(404, 'not_found');
    // The client's own context for its row and its event, then Kete's again for the journal.
    await setOrganization(tx, organization);
    try {
      const { rows } = await tx.query<{
        product: string;
        mode: DeploymentMode;
        status: string;
        requested_mode: DeploymentMode | null;
      }>(`select product, mode, status, requested_mode from deployments where id = $1 for update`, [
        deploymentId,
      ]);
      const row = rows[0];
      if (!row) throw new FleetError(404, 'not_found');
      if (row.status === 'ready' && !row.requested_mode) {
        throw new FleetError(409, 'nothing_to_make');
      }
      const mode = row.status === 'requested' ? row.mode : (row.requested_mode as DeploymentMode);
      await tx.query(
        `update deployments set status = 'ready', mode = $2, url = $3, requested_mode = null,
           updated_at = now() where id = $1`,
        [deploymentId, mode, url],
      );
      await recordEvent(
        tx,
        accountEvent('deployment.ready', organization, {
          deployment_id: deploymentId,
          product: row.product,
          mode,
          url,
        }),
      );
      return { deploymentId, organizationId: organization, mode, url };
    } finally {
      await setOrganization(tx, operators);
    }
  },
  summarize: ({ deploymentId, url }) => `Deployment ${deploymentId} made, at ${url}`,
});

export async function makeReady(
  input: z.input<typeof makeReadyInput>,
  gesture: OperatorGesture,
): Promise<{ deploymentId: string; organizationId: string; mode: DeploymentMode; url: string }> {
  const transaction = <T>(organizationId: string, work: (db: SqlExecutor) => Promise<T>) =>
    inOrganizationTx(db, organizationId, (tx) => work(sqlExecutorOf(tx)));
  return (await runOperatorGesture(transaction, makeDeploymentReady, gesture, input)).output;
}
