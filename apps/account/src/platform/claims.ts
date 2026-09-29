/** The audience of every token meant for Kete apps (an absolute URI, RFC 8707). */
export const KETE_APPS_AUDIENCE = 'urn:kete:apps';

/** Claims every Kete app reads from a Compte Kete token (@kete/auth). */
export interface KeteClaims {
  email: string;
  name: string;
  org: string | null;
  role: 'owner' | 'admin' | 'member' | null;
  /** Apps the organization may use, each with the end of its access (grace included). */
  apps: Record<string, string>;
  /** Whether the person signs in with a second factor. */
  two_factor: boolean;
}
