import type { KeteIdentity } from '@kete/auth';
import type { Actor, Channel } from '@kete/commands';

export class AdminError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly code: 'unauthenticated' | 'invalid_token' | 'not_an_operator',
  ) {
    super(code);
    this.name = 'AdminError';
  }
}

export interface OperatorGuardOptions {
  /** Verifies a Compte Kete access token (@kete/auth `createTokenVerifier`). */
  verify(token: string): Promise<KeteIdentity>;
  /** Kete's own organization (`KETE_OPERATORS_ORGANIZATION_ID`); null: nobody is an operator. */
  operatorsOrganizationId(): string | null;
  /** Still an operator now, in the identity's records: a token lives fifteen minutes. */
  stillOperator?(userId: string): Promise<boolean>;
}

export interface OperatorGuard {
  /**
   * The caller of an operator API: a Kete operator's bearer token — owner or admin of Kete's own
   * organization, signing in strongly (specs 007 and 016).
   */
  requireOperator(request: Request): Promise<KeteIdentity>;
}

export function createOperatorGuard(options: OperatorGuardOptions): OperatorGuard {
  return {
    async requireOperator(request) {
      const header = request.headers.get('authorization') ?? '';
      const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
      if (!token) throw new AdminError(401, 'unauthenticated');
      let identity: KeteIdentity;
      try {
        identity = await options.verify(token);
      } catch {
        throw new AdminError(401, 'invalid_token');
      }
      const operators = options.operatorsOrganizationId();
      const claimsSayOperator =
        operators !== null &&
        identity.organizationId === operators &&
        (identity.role === 'owner' || identity.role === 'admin') &&
        identity.twoFactor;
      if (!claimsSayOperator) throw new AdminError(403, 'not_an_operator');
      if (options.stillOperator && !(await options.stillOperator(identity.userId))) {
        throw new AdminError(403, 'not_an_operator');
      }
      return identity;
    },
  };
}

/** An operator acts as herself, always named in the journal. */
export function operatorActor(identity: KeteIdentity, channel: Channel = 'api'): Actor {
  return { kind: 'person', id: identity.userId, channel };
}

/** The answer of an operator API to its guard's refusal (null for any other error). */
export function adminErrorResponse(error: unknown): Response | null {
  return error instanceof AdminError
    ? Response.json({ error: error.code }, { status: error.status })
    : null;
}
