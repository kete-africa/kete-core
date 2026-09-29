import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { z } from 'zod';
import { accessUntil } from '@/features/payments/access';
import { toolCatalog } from '@/features/tools/catalog';
import { eq } from 'drizzle-orm';
import { actorFromHeaders, ForbiddenError, requireMember } from '@/platform/actor';
import { db } from '@/platform/db';
import { user } from '@/platform/schema';
import { readInvitation, readMembers, readViewer } from './viewer';

export const fetchViewer = createServerFn({ method: 'GET' }).handler(async () =>
  readViewer(await actorFromHeaders(getRequestHeaders())),
);

export const fetchMembers = createServerFn({ method: 'GET' }).handler(async () => {
  const me = requireMember(await actorFromHeaders(getRequestHeaders()));
  return readMembers(me.organizationId);
});

export const fetchInvitation = createServerFn({ method: 'GET' })
  .validator((input: unknown) => z.object({ id: z.string().min(1).max(64) }).parse(input))
  .handler(({ data }) => readInvitation(data.id));

export const fetchTools = createServerFn({ method: 'GET' }).handler(async () => {
  const me = requireMember(await actorFromHeaders(getRequestHeaders()));
  const access = await accessUntil(me.organizationId);
  return toolCatalog().map((tool) => ({ ...tool, accessUntil: access[tool.id] ?? null }));
});

export const fetchSecurity = createServerFn({ method: 'GET' }).handler(async () => {
  const actor = await actorFromHeaders(getRequestHeaders());
  if (!actor) throw new ForbiddenError('unauthenticated');
  const [row] = await db
    .select({ twoFactorEnabled: user.twoFactorEnabled })
    .from(user)
    .where(eq(user.id, actor.userId));
  return { twoFactorEnabled: row?.twoFactorEnabled === true };
});
