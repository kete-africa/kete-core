import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// The public internet only (spec 129): what an agent or an import reaches outside — a tool's
// description, a page it reads — is an `https` address whose every resolved IP is public, with no
// redirection, a timeout and a bounded answer. Nobody uses Kete to reach a company's private
// network, nor the instance's own.

/** Whether an IP address is on the public internet (never a private, loopback or link-local one). */
export function isPublicIp(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0] = address.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a >= 224) return false;
    return true;
  }
  const v6 = address.toLowerCase();
  if (v6 === '::1' || v6 === '::') return false;
  if (v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')) return false;
  if (v6.startsWith('::ffff:')) return isPublicIp(v6.slice('::ffff:'.length));
  return true;
}

/** Whether an address may be reached: https, and every IP it resolves to is public. */
export async function reachable(address: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return isPublicIp(host);
  const resolved = await lookup(host, { all: true }).catch(() => []);
  return resolved.length > 0 && resolved.every((r) => isPublicIp(r.address));
}

/** The longest answer read from outside: beyond, it is refused. */
export const PUBLIC_LIMIT = 2_000_000;

/** A fetch that refuses what is not public, follows no redirection and cuts a long answer. */
export const publicFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  if (!(await reachable(request.url))) {
    throw new Error('This address is not on the public internet.');
  }
  const response = await fetch(request, {
    redirect: 'error',
    signal: init?.signal ?? AbortSignal.timeout(20_000),
  });
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > PUBLIC_LIMIT) throw new Error('The answer is too long.');
  return response;
};
