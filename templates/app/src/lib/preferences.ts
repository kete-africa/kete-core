import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { savePreferenceOf } from '@/platform/settings';

/** Saves one of her preferences in the Compte Kete (kete-core spec 115): it follows her everywhere. */
export const saveMyPreference = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({ key: z.enum(['kete.theme', 'kete.locale']), value: z.string().max(10) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const saved = await savePreferenceOf(getRequest(), data.key, data.value);
    return { ok: saved.ok };
  });
