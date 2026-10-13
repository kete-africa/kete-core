import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { z } from 'zod';
import { actorFromHeaders } from '@/platform/actor';
import {
  BillingError,
  checkoutInput,
  confirmCheckout,
  readBilling,
  startCheckout,
  startTrial,
} from './billing';

export const fetchBilling = createServerFn({ method: 'GET' }).handler(async () =>
  readBilling(await actorFromHeaders(getRequestHeaders())),
);

export const beginCheckout = createServerFn({ method: 'POST' })
  .validator((input: unknown) => checkoutInput.parse(input))
  .handler(async ({ data }) => {
    try {
      return {
        ok: true as const,
        ...(await startCheckout(await actorFromHeaders(getRequestHeaders()), data)),
      };
    } catch (error) {
      // Reasons the screen can explain; anything else is an error.
      if (error instanceof BillingError) return { ok: false as const, reason: error.code };
      throw error;
    }
  });

/** Starts the free trial of an app, once (spec 092). */
export const beginTrial = createServerFn({ method: 'POST' })
  .validator((input: unknown) => z.object({ offerId: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) => {
    try {
      return {
        ok: true as const,
        ...(await startTrial(await actorFromHeaders(getRequestHeaders()), data.offerId)),
      };
    } catch (error) {
      if (error instanceof BillingError) return { ok: false as const, reason: error.code };
      throw error;
    }
  });

export const verifyCheckout = createServerFn({ method: 'POST' })
  .validator((input: unknown) => z.object({ checkoutId: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) =>
    confirmCheckout(await actorFromHeaders(getRequestHeaders()), data.checkoutId),
  );
