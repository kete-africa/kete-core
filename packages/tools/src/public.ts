import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';

// The public internet only (spec 129; hardened by spec 134): what an agent or an import reaches
// outside — a tool's description, a page it reads — is an `https` address whose every resolved IP
// is public, with no redirection, a timeout and a bounded answer. The address is checked again at
// the very moment of connecting, so a name that answers « public » to the check and « private » to
// the connection (DNS rebinding) is refused. Nobody uses Kete to reach a company's private network,
// nor the instance's own.

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

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * The name resolution used when connecting: it refuses a name that resolves, at that moment, to
 * any address that is not public.
 */
export function publicLookup(hostname: string, options: LookupOptions, callback: LookupCallback) {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, []);
    const list = addresses;
    if (list.length === 0 || !list.every((one) => isPublicIp(one.address))) {
      const refused: NodeJS.ErrnoException = new Error(
        `${hostname} is not on the public internet.`,
      );
      refused.code = 'ENOTPUBLIC';
      return callback(refused, []);
    }
    if (options.all) return callback(null, list);
    const first = list[0] as LookupAddress;
    return callback(null, first.address, first.family);
  });
}

const dispatcher = new Agent({ connect: { lookup: publicLookup } });

/** The longest answer read from outside: beyond, it is refused. */
export const PUBLIC_LIMIT = 2_000_000;

/** A body that stops with an error once it went beyond `limit` bytes. */
function bounded(body: ReadableStream<Uint8Array> | null, limit: number) {
  if (!body) return null;
  let total = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > limit) controller.error(new Error('The answer is too long.'));
        else controller.enqueue(chunk);
      },
    }),
  );
}

/**
 * A fetch that refuses what is not public — before, and again when connecting — follows no
 * redirection, stops after a timeout and cuts an answer longer than `PUBLIC_LIMIT`.
 */
export const publicFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  if (!(await reachable(request.url))) {
    throw new Error('This address is not on the public internet.');
  }
  const body = request.body ? await request.arrayBuffer() : undefined;
  const response = await undiciFetch(request.url, {
    method: request.method,
    headers: [...request.headers],
    ...(body ? { body } : {}),
    redirect: 'error',
    signal: init?.signal ?? AbortSignal.timeout(20_000),
    dispatcher,
  });
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > PUBLIC_LIMIT) throw new Error('The answer is too long.');
  return new Response(bounded(response.body as ReadableStream<Uint8Array> | null, PUBLIC_LIMIT), {
    status: response.status,
    statusText: response.statusText,
    headers: [...response.headers],
  });
};
