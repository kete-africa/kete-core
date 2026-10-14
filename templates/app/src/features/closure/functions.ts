import type { StoredProposalSet } from '@kete/drafts';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getDictation } from '@/platform/dictation';
import { signedIn } from '@/platform/screen';
import { recordUse } from '@/platform/usage';
import { applyDay, dismissDay, undoDay, understandDay } from './closure';

/** A proposal set as the screen shows it: plain, serializable values. */
export interface ScreenSet {
  id: string;
  status: StoredProposalSet['status'];
  items: {
    key: string;
    label: string;
    reason: string | null;
    level: 1 | 2 | 3 | 4;
    ticked: boolean;
  }[];
  outcomes: Record<string, StoredProposalSet['outcomes'][number]['state']>;
}

const toScreen = (stored: StoredProposalSet): ScreenSet => ({
  id: stored.set.id,
  status: stored.status,
  items: stored.set.items.map((item) => ({
    key: item.key,
    label: item.label,
    reason: item.reason ?? null,
    level: Math.min(Math.max(item.level, 1), 4) as 1 | 2 | 3 | 4,
    ticked: item.ticked ?? false,
  })),
  outcomes: Object.fromEntries(stored.outcomes.map((o) => [o.key, o.state])),
});

/** Whether the voice is offered: a transcription model is configured. */
export const fetchClosure = createServerFn({ method: 'GET' }).handler(async () => {
  await signedIn();
  return { voice: getDictation() !== null };
});

export const understandMyDay = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z.object({ text: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { identity, caller, as } = await signedIn();
    const understood = await understandDay(identity, data.text, as);
    if (understood.status === 'proposed') {
      await recordUse(caller.organizationId, 'closure_understood', identity.userId);
      return {
        status: 'proposed' as const,
        set: toScreen(understood.set),
        unclear: understood.unclear,
      };
    }
    return understood.status === 'nothing'
      ? { status: 'nothing' as const, unclear: understood.unclear }
      : { status: 'not_connected' as const };
  });

export const decideMyDay = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().min(1).max(80),
        ticked: z.array(z.string().max(100)).max(30),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { identity, as } = await signedIn();
    const stored = await applyDay(identity, data.id, data.ticked, as);
    return stored ? toScreen(stored) : null;
  });

export const dismissMyDay = createServerFn({ method: 'POST' })
  .validator((input: unknown) => z.object({ id: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { identity } = await signedIn();
    const stored = await dismissDay(identity, data.id);
    return stored ? toScreen(stored) : null;
  });

export const undoMyDay = createServerFn({ method: 'POST' })
  .validator((input: unknown) => z.object({ id: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { identity, as } = await signedIn();
    const stored = await undoDay(identity, data.id, as);
    return stored ? toScreen(stored) : null;
  });

/** What she said, written down by the dictation port; the recording is not kept. */
export const dictateMyDay = createServerFn({ method: 'POST' })
  .validator((input: unknown) => z.object({ audio: z.string().min(1).max(8_000_000) }).parse(input))
  .handler(async ({ data }) => {
    const { identity, caller } = await signedIn();
    const port = getDictation();
    if (!port) return { status: 'not_connected' as const };
    const said = await port.dictate(Uint8Array.from(Buffer.from(data.audio, 'base64')));
    await recordUse(caller.organizationId, 'closure_dictated', identity.userId);
    return said.text
      ? { status: 'heard' as const, text: said.text }
      : { status: 'silent' as const };
  });
