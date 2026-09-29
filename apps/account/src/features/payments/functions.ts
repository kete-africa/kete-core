import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { z } from 'zod';
import { actorFromHeaders } from '@/platform/actor';
import { checkoutInput, confirmCheckout, readBilling, startCheckout } from './billing';

export const fetchBilling = createServerFn({ method: 'GET' }).handler(async () =>
  readBilling(await actorFromHeaders(getRequestHeaders())),
);

export const beginCheckout = createServerFn({ method: 'POST' })
  .validator((input: unknown) => checkoutInput.parse(input))
  .handler(async ({ data }) => startCheckout(await actorFromHeaders(getRequestHeaders()), data));

export const verifyCheckout = createServerFn({ method: 'POST' })
  .validator((input: unknown) => z.object({ checkoutId: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) =>
    confirmCheckout(await actorFromHeaders(getRequestHeaders()), data.checkoutId),
  );
