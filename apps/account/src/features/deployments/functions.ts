import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { actorFromHeaders, canAdminister, ForbiddenError, requireMember } from '@/platform/actor';
import { getLocale } from '@/paraglide/runtime.js';
import {
  DEPLOYABLE_APPS,
  deploy,
  DeploymentError,
  deploymentOf,
  deployRegions,
  sharedUrl,
  type DeployInput,
} from './deployments';

/** « Mon Kete » (spec 123): how the organization's Kete runs, and what it may choose. */
export const fetchMyKete = createServerFn({ method: 'GET' }).handler(async () => {
  const me = requireMember(await actorFromHeaders(getRequestHeaders()));
  const lang = getLocale() === 'en' ? 'en' : 'fr';
  return {
    deployment: await deploymentOf(me.organizationId),
    canDeploy: canAdminister(me.role),
    sharedAvailable: sharedUrl() !== null,
    regions: deployRegions().map((region) => ({ id: region.id, label: region.label[lang] })),
    apps: [...DEPLOYABLE_APPS],
  };
});

/** Deploys it, or asks another mode; a refusal comes back as its code. */
export const deployMyKete = createServerFn({ method: 'POST' })
  .validator((input: unknown) => input as DeployInput)
  .handler(async ({ data }) => {
    try {
      const deployment = await deploy(await actorFromHeaders(getRequestHeaders()), data);
      return { ok: true as const, deployment };
    } catch (error) {
      if (error instanceof DeploymentError) return { ok: false as const, error: error.code };
      if (error instanceof ForbiddenError) return { ok: false as const, error: 'forbidden' };
      return { ok: false as const, error: 'invalid' };
    }
  });
