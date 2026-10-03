import { PRODUCT_HEADER, SIGNATURE_HEADER, sign, type SigningKey } from '@kete/sdk';
import type { AppRequest, Progress, RequestStatus } from '../request.js';

// The factory tells Kete Enterprise where a request stands (spec 048), signed with the key they
// share: the status and what was produced — never a secret.

export const FACTORY_PRODUCT = 'prd_kete_factory';

export function reportTo(key: SigningKey, fetcher: typeof fetch = fetch) {
  return async (request: AppRequest, status: RequestStatus, progress: Progress): Promise<void> => {
    const body = JSON.stringify({
      requestId: request.requestId,
      organizationId: request.organizationId,
      status,
      repository: progress.repository ?? null,
      url: progress.url ?? null,
      pullRequest: progress.pullRequest ?? null,
      error: progress.error ?? null,
    });
    const response = await fetcher(request.callbackUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [PRODUCT_HEADER]: FACTORY_PRODUCT,
        [SIGNATURE_HEADER]: sign(body, key),
      },
      body,
    });
    if (!response.ok) throw new Error(`Report to Enterprise: ${response.status}`);
  };
}
