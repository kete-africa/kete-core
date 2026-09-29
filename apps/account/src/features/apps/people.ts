import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { jwtVerify, createLocalJWKSet, type JSONWebKeySet } from 'jose';
import { z } from 'zod';
import { auth } from '@/platform/auth';
import { KETE_APPS_AUDIENCE } from '@/platform/claims';
import { isPlaceholderEmail, placeholderEmail } from '@/platform/contact';
import { db } from '@/platform/db';
import { env } from '@/platform/env';
import { prefixedId } from '@/platform/ids';
import { PEOPLE_SCOPE } from '@/platform/oauth';
import { appSignInLinks, member, oauthClient, user } from '@/platform/schema';
import { captureSignInLink, SIGN_IN_LINK_SECONDS } from '@/platform/sign-in-links';

/**
 * Spec 013 — a trusted Kete app (Firmo first) provisions people by the phone number a messaging
 * channel proved, and asks for their one-time sign-in links. The person never fills a form.
 */
export class AppApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 422,
    readonly code: string,
  ) {
    super(code);
    this.name = 'AppApiError';
  }
}

export interface CallingApp {
  clientId: string;
  redirectOrigins: string[];
}

/**
 * The calling app: a `client_credentials` token this Compte Kete issued, carrying `kete:people`,
 * from a client still granted that scope and not disabled.
 */
export async function requireApp(request: Request): Promise<CallingApp> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) throw new AppApiError(401, 'unauthenticated');
  let payload: Record<string, unknown>;
  try {
    const jwks = await (auth.api as unknown as { getJwks(): Promise<JSONWebKeySet> }).getJwks();
    ({ payload } = await jwtVerify(token, createLocalJWKSet(jwks), {
      issuer: env.publicUrl,
      audience: KETE_APPS_AUDIENCE,
    }));
  } catch {
    throw new AppApiError(401, 'invalid_token');
  }
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const scopes = text(payload.scope).split(' ');
  const clientId = text(payload.azp) || text(payload.client_id);
  // A person's token never provisions people: only the app itself, with no person behind it.
  const personBehind = typeof payload.sub === 'string' && payload.sub !== clientId;
  if (!clientId || personBehind || !scopes.includes(PEOPLE_SCOPE)) {
    throw new AppApiError(403, 'not_allowed');
  }
  const [client] = await db
    .select({
      disabled: oauthClient.disabled,
      scopes: oauthClient.clientCredentialsScopes,
      redirectUris: oauthClient.redirectUris,
    })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId));
  if (!client || client.disabled || !client.scopes?.includes(PEOPLE_SCOPE)) {
    throw new AppApiError(403, 'not_allowed');
  }
  const redirectOrigins = client.redirectUris.flatMap((uri) => {
    try {
      return [new URL(uri).origin];
    } catch {
      return [];
    }
  });
  return { clientId, redirectOrigins };
}

const e164 = z.string().regex(/^\+[1-9]\d{7,14}$/, 'an E.164 phone number');

export const personInput = z.object({
  phoneNumber: e164,
  name: z.string().trim().min(1).max(200).nullish(),
  organizationName: z.string().trim().min(1).max(200).nullish(),
});

export { isPlaceholderEmail };

async function firstOrganization(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt))
    .limit(1);
  return row?.organizationId ?? null;
}

function slugOf(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base || 'activite'}-${prefixedId('slug').slice(4, 12).toLowerCase()}`;
}

async function createOrganizationFor(userId: string, name: string): Promise<string> {
  const api = auth.api as unknown as {
    createOrganization(input: { body: { name: string; slug: string; userId: string } }): Promise<{
      id: string;
    }>;
  };
  const created = await api.createOrganization({ body: { name, slug: slugOf(name), userId } });
  return created.id;
}

/** The person with this number and her organization — created in silence if new. */
export async function provisionPerson(
  input: z.input<typeof personInput>,
): Promise<{ personId: string; organizationId: string; created: boolean }> {
  const parsed = personInput.safeParse(input);
  if (!parsed.success) throw new AppApiError(422, 'invalid_input');
  const { phoneNumber } = parsed.data;
  const name = parsed.data.name ?? phoneNumber;
  const organizationName = parsed.data.organizationName ?? parsed.data.name ?? phoneNumber;

  const existing = async () => {
    const [row] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.phoneNumber, phoneNumber));
    return row?.id ?? null;
  };

  let personId = await existing();
  let created = false;
  if (!personId) {
    const now = new Date();
    const id = prefixedId('user');
    try {
      await db.insert(user).values({
        id,
        name,
        email: placeholderEmail(phoneNumber),
        emailVerified: false,
        phoneNumber,
        createdAt: now,
        updatedAt: now,
      });
      personId = id;
      created = true;
    } catch (error) {
      // Two first messages at once: the other request created her; use that one.
      personId = await existing();
      if (!personId) throw error;
    }
  }
  const organizationId =
    (await firstOrganization(personId)) ??
    (await createOrganizationFor(personId, organizationName));
  return { personId, organizationId, created };
}

export const signInLinkInput = z.object({
  personId: z.string().min(1).max(100),
  returnTo: z.url().max(2000),
});

/**
 * A one-time sign-in link for a person provisioned by phone, landing on the app's own origin.
 * Never for a person protected by a second factor (an operator): a link would bypass it.
 */
export async function createSignInLink(
  app: CallingApp,
  input: z.input<typeof signInLinkInput>,
): Promise<{ url: string; expiresAt: string }> {
  const parsed = signInLinkInput.safeParse(input);
  if (!parsed.success) throw new AppApiError(422, 'invalid_input');
  const returnTo = new URL(parsed.data.returnTo);
  if (!app.redirectOrigins.includes(returnTo.origin)) {
    throw new AppApiError(422, 'return_address_not_allowed');
  }
  const [person] = await db
    .select({
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      twoFactorEnabled: user.twoFactorEnabled,
    })
    .from(user)
    .where(eq(user.id, parsed.data.personId));
  if (!person?.phoneNumber) throw new AppApiError(404, 'not_found');
  if (person.twoFactorEnabled) throw new AppApiError(403, 'second_factor_required');

  const id = prefixedId('signInLink');
  const expiresAt = new Date(Date.now() + SIGN_IN_LINK_SECONDS * 1000);
  await db.insert(appSignInLinks).values({
    id,
    clientId: app.clientId,
    userId: person.id,
    returnTo: returnTo.toString(),
    expiresAt,
  });
  const api = auth.api as unknown as {
    signInMagicLink(input: {
      body: { email: string; callbackURL: string; errorCallbackURL: string };
      headers: Headers;
    }): Promise<unknown>;
  };
  const url = await captureSignInLink(() =>
    api.signInMagicLink({
      body: {
        email: person.email,
        callbackURL: `/api/apps/continue?link=${id}`,
        errorCallbackURL: '/connexion?lien=expire',
      },
      headers: new Headers(),
    }),
  );
  return { url, expiresAt: expiresAt.toISOString() };
}

/**
 * After the magic link signed the person in: the link must be hers, unused and unexpired; then
 * she lands on the app's return address, where its single sign-on completes.
 */
export async function continueSignIn(request: Request): Promise<Response> {
  const fallback = new Response(null, {
    status: 302,
    headers: { location: '/connexion?lien=expire' },
  });
  const linkId = new URL(request.url).searchParams.get('link') ?? '';
  const session = await auth.api.getSession({ headers: request.headers });
  if (!linkId || !session) return fallback;
  const [used] = await db
    .update(appSignInLinks)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(appSignInLinks.id, linkId),
        eq(appSignInLinks.userId, session.user.id),
        isNull(appSignInLinks.usedAt),
        sql`${appSignInLinks.expiresAt} > now()`,
      ),
    )
    .returning({ returnTo: appSignInLinks.returnTo });
  if (!used) return fallback;
  return new Response(null, { status: 302, headers: { location: used.returnTo } });
}

/** Maps an error to the app API's answer. */
export function appApiResponse(error: unknown): Response {
  if (error instanceof AppApiError) {
    return Response.json({ error: error.code }, { status: error.status });
  }
  throw error;
}
