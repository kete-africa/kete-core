import { eq } from 'drizzle-orm';
import { db } from '@/platform/db';
import { oauthClient } from '@/platform/schema';

// Where a person goes back after changing her organization (Kete Enterprise spec 098, FR-001): only
// to an app the Compte Kete knows — an origin of a client's return address — never anywhere else.

/** Whether an address belongs to a registered app: its origin is one of a client's returns. */
export async function isAppAddress(address: string): Promise<boolean> {
  let origin: string;
  try {
    const url = new URL(address);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    origin = url.origin;
  } catch {
    return false;
  }
  const clients = await db
    .select({ redirectUris: oauthClient.redirectUris })
    .from(oauthClient)
    .where(eq(oauthClient.disabled, false));
  return clients.some((client) =>
    client.redirectUris.some((uri) => {
      try {
        return new URL(uri).origin === origin;
      } catch {
        return false;
      }
    }),
  );
}
