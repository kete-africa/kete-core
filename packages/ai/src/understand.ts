import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { extract, type Metering } from './ask.js';

// Understanding a note (kete-core spec 104; doctrine D-051): what a person wrote or said at the end
// of her day — « fini le devis de la Pharmacie, relancer Ecobank jeudi, je n'ai pas eu le temps
// pour le rapport » — becomes gestures proposed to her, on the objects the app knows and with the
// gestures it offers. Nothing is guessed: an object the note does not name, or a gesture not
// offered, is left out; what the model could not place is said back to her, in her words.

/** The gestures of a proposal set (contract proposal-set.v1). */
export type ProposalGesture =
  'postpone' | 'close' | 'block' | 'assign' | 'correct' | 'remind' | 'lesson' | 'create';

/** Something of hers the note may speak of: a task, a quote, a meeting. */
export interface KnownObject {
  key: string;
  /** What it is, in a word: `task`, `quote`. */
  kind: string;
  label: string;
  /** Its day, when it has one: `2026-10-16`. */
  due?: string;
}

/** A gesture the app can apply, and how. */
export interface GestureOffer {
  gesture: ProposalGesture;
  /** What it does, for the model: « close a task that is done ». */
  describe: string;
  /** The autonomy level of the capability that applies it. */
  level: 1 | 2 | 3 | 4;
  capability?: string;
  /** Whether it needs one of the known objects; `create` does not. */
  needsObject?: boolean;
  /** The capability's input, from what was understood. */
  inputOf?: (understood: {
    object: KnownObject | null;
    day: string | null;
    text: string;
  }) => Record<string, unknown>;
}

/** A proposed item, in the shape of proposal-set.v1. */
export interface ProposedItem {
  key: string;
  gesture: ProposalGesture;
  label: string;
  reason?: string;
  level: 1 | 2 | 3 | 4;
  capability?: string;
  input?: Record<string, unknown>;
  ticked: boolean;
}

const answer = z.object({
  items: z
    .array(
      z.object({
        gesture: z.string().describe('One of the gestures offered, by its name.'),
        object: z
          .string()
          .nullable()
          .describe('The key of the known object it is about; null for none.'),
        day: z.iso
          .date()
          .nullable()
          .describe('The day it names, YYYY-MM-DD, computed from today; null when none.'),
        label: z
          .string()
          .min(1)
          .max(300)
          .describe('What will happen, in her language, in a short sentence.'),
        reason: z.string().max(300).nullable().describe('The words of her note it comes from.'),
      }),
    )
    .max(30),
  unclear: z
    .array(z.string().max(300))
    .max(10)
    .describe('The parts of the note that name nothing known and no gesture offered, as written.'),
});

/**
 * The gestures a note proposes: each on a known object and an offered gesture, its level and its
 * capability from the offer — never from the model. Up to level 2 an item comes ticked; above, she
 * ticks it herself.
 */
export async function understand(options: {
  model: LanguageModel;
  /** Her note, or the transcript of what she said. */
  text: string;
  /** Her today, `2026-10-14`: « jeudi » is read from it. */
  today: string;
  known: readonly KnownObject[];
  offers: readonly GestureOffer[];
  /** The language she writes in: the labels follow it. */
  language?: string;
  metering?: Metering;
}): Promise<{ items: ProposedItem[]; unclear: string[] }> {
  const text = options.text.trim();
  if (!text) return { items: [], unclear: [] };
  const { value } = await extract({
    model: options.model,
    schema: answer,
    system: [
      'You read what a person wrote or said about her work and propose gestures to her.',
      'Use only the gestures offered and only the known objects, by their key. Never invent one.',
      `Today is ${options.today}. Write each label in ${options.language ?? 'the language of the note'}.`,
      'Gestures offered:',
      ...options.offers.map((offer) => `- ${offer.gesture}: ${offer.describe}`),
      'Known objects:',
      ...options.known.map(
        (o) => `- ${o.key} (${o.kind}) ${o.label}${o.due ? `, due ${o.due}` : ''}`,
      ),
    ].join('\n'),
    prompt: text,
    ...(options.metering ? { metering: options.metering } : {}),
  });
  const items: ProposedItem[] = [];
  for (const [index, proposed] of value.items.entries()) {
    const offer = options.offers.find((o) => o.gesture === proposed.gesture);
    if (!offer) continue;
    const object = proposed.object
      ? (options.known.find((o) => o.key === proposed.object) ?? null)
      : null;
    // An object it named that she does not have, or a gesture that needs one without it: left out.
    if ((proposed.object && !object) || ((offer.needsObject ?? true) && !object)) continue;
    const input = offer.inputOf?.({ object, day: proposed.day, text: proposed.label });
    items.push({
      key: `${offer.gesture}-${object?.key ?? index}`,
      gesture: offer.gesture,
      label: proposed.label,
      ...(proposed.reason ? { reason: proposed.reason } : {}),
      level: offer.level,
      ...(offer.capability ? { capability: offer.capability } : {}),
      ...(input ? { input } : {}),
      ticked: offer.level <= 2,
    });
  }
  // Two gestures on one object: the first stands.
  const seen = new Set<string>();
  return {
    items: items.filter((item) => !seen.has(item.key) && (seen.add(item.key), true)),
    unclear: value.unclear,
  };
}
