import type { Identity } from '../ports.js';

// The Compte Kete (spec 048): the factory signs in as its own client (`client_credentials`, scope
// `kete:factory`) and registers each app it creates at `/api/apps/clients`.

export interface AccountOptions {
  url: string;
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
}

export function compteKete(options: AccountOptions): Identity {
  const http = options.fetch ?? fetch;
  const base = options.url.replace(/\/$/, '');
  return {
    async registerApp(input) {
      const token = await http(`${base}/api/auth/oauth2/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: options.clientId,
          client_secret: options.clientSecret,
          scope: 'kete:factory',
          resource: 'urn:kete:apps',
        }),
      });
      if (!token.ok) throw new Error(`Compte Kete token: ${token.status}`);
      const { access_token: accessToken } = (await token.json()) as { access_token: string };
      const response = await http(`${base}/api/apps/clients`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (response.status !== 201) {
        const answer = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(`Compte Kete registration: ${response.status} ${answer.error ?? ''}`);
      }
      return (await response.json()) as { clientId: string; clientSecret: string };
    },
  };
}
