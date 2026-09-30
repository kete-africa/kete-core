import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { z } from 'zod';
import { accessUntil } from '@/features/payments/access';
import { toolCatalog } from '@/features/tools/catalog';
import { eq } from 'drizzle-orm';
import { actorFromHeaders, ForbiddenError, requireMember } from '@/platform/actor';
import { auth } from '@/platform/auth';
import { db } from '@/platform/db';
import { removePassword, signInMethods } from '@/platform/strength';
import { passkey, user } from '@/platform/schema';
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
  const methods = await signInMethods(actor.userId);
  const keys = await db
    .select({ id: passkey.id, name: passkey.name, createdAt: passkey.createdAt })
    .from(passkey)
    .where(eq(passkey.userId, actor.userId))
    .orderBy(passkey.createdAt);
  return {
    twoFactorEnabled: row?.twoFactorEnabled === true,
    password: methods.password,
    passkeys: keys.map((key) => ({
      id: key.id,
      name: key.name,
      createdAt: key.createdAt ? key.createdAt.toISOString() : null,
    })),
  };
});

/** How recent a sign-in must be to remove the password: the passkey was just used (spec 016). */
const FRESH_SIGN_IN_MS = 5 * 60 * 1000;

/** Removes her password once she has a passkey and has just signed in with it (spec 016). */
export const removeMyPassword = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new ForbiddenError('unauthenticated');
  if (Date.now() - new Date(session.session.createdAt).getTime() > FRESH_SIGN_IN_MS) {
    return { ok: false as const, reason: 'sign_in_again' as const };
  }
  const outcome = await removePassword(session.user.id);
  return outcome === 'removed'
    ? { ok: true as const }
    : { ok: false as const, reason: 'passkey_required' as const };
});
