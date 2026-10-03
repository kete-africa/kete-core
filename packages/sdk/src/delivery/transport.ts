import type { DeliveryResult } from '../contracts/types.gen.js';
import { validateDeliveryResult } from '../contracts/validate.js';
import { PRODUCT_HEADER, SIGNATURE_HEADER } from '../signing/signature.js';

/** Raised when a delivery may succeed later: network error, receiver down, rejected credentials. */
export class TransientDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientDeliveryError';
  }
}

/** Sends one signed batch and returns the receiver's outcome per event. */
export interface Transport {
  send(request: { body: string; product: string; signature: string }): Promise<DeliveryResult>;
}

/**
 * HTTP transport. Any failure without a valid per-event result is transient: the relay retries.
 * A batch-level refusal (bad signature, stale, unknown product) is usually a configuration error,
 * so it is retried too — the growing backlog shows in the app's health.
 */
export function httpTransport(options: {
  url: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  /**
   * The app's own token, for a receiver that authenticates apps by it (a center, spec 049). Null:
   * no credentials yet, the batch waits.
   */
  token?: () => Promise<string | null>;
}): Transport {
  const doFetch = options.fetch ?? fetch;
  return {
    async send({ body, product, signature }) {
      const token = options.token ? await options.token() : undefined;
      if (token === null) throw new TransientDeliveryError('no token for the receiver');
      let response: Response;
      try {
        response = await doFetch(options.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            [PRODUCT_HEADER]: product,
            ...(signature ? { [SIGNATURE_HEADER]: signature } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body,
          signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
        });
      } catch (error) {
        throw new TransientDeliveryError(`network: ${(error as Error).message}`);
      }
      if (response.status !== 200) {
        throw new TransientDeliveryError(`receiver answered ${response.status}`);
      }
      const result: unknown = await response.json().catch(() => null);
      if (!validateDeliveryResult(result).ok) {
        throw new TransientDeliveryError('receiver answered an invalid result');
      }
      return result as DeliveryResult;
    },
  };
}
