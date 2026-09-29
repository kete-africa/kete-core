import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { z } from 'zod';
import { actorFromHeaders } from '@/platform/actor';
import { completeLogoUpload, logoUploadInput, removeLogo, requestLogoUpload } from './logo';

export const startLogoUpload = createServerFn({ method: 'POST' })
  .validator((input: unknown) => logoUploadInput.parse(input))
  .handler(async ({ data }) =>
    requestLogoUpload(await actorFromHeaders(getRequestHeaders()), data),
  );

export const finishLogoUpload = createServerFn({ method: 'POST' })
  .validator((input: unknown) => z.object({ fileId: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) =>
    completeLogoUpload(await actorFromHeaders(getRequestHeaders()), data.fileId),
  );

export const deleteLogo = createServerFn({ method: 'POST' }).handler(async () => {
  await removeLogo(await actorFromHeaders(getRequestHeaders()));
  return { ok: true as const };
});
