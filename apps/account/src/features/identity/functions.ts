import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { z } from 'zod';
import { toolCatalog } from '@/features/tools/catalog';
import { actorFromHeaders, requireMember } from '@/platform/actor';
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
  requireMember(await actorFromHeaders(getRequestHeaders()));
  return toolCatalog();
});
