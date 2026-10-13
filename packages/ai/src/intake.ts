import type { ActorRef } from '@kete/commands';
import type { LanguageModel, ModelMessage } from 'ai';
import { z } from 'zod';
import { extract, type Metering } from './ask.js';

// Intake (spec 098): a message, a photo, a voice note or a document becomes the values of a
// record — a draft a person verifies — and every value says where it comes from: from which
// source, how sure the reading is, and the passage it was read in. What the source does not say
// is left empty, never guessed: the person types it.

/** What was received: the words of a message or a transcript, or a file. */
export type IntakeSource =
  | { kind: 'message'; text: string }
  | { kind: 'voice'; transcript: string }
  | { kind: 'photo'; data: Uint8Array; contentType: string }
  | { kind: 'document'; data: Uint8Array; contentType: string };

/** Where a value comes from, as a draft keeps it (`@kete/drafts`' `FieldProvenance`). */
export interface IntakeProvenance {
  source: IntakeSource['kind'];
  by: ActorRef;
  certainty: 'high' | 'medium' | 'low';
  /** The passage the value was read in, as it is written there. */
  quote?: string;
  /** What was read: the file or the message, by its identifier. */
  evidence?: string;
}

export interface Intake<Values> {
  /** The values found, valid each for its field; the others are left out. */
  values: Partial<Values>;
  provenance: Record<string, IntakeProvenance>;
  /** The required fields the source does not give: the person types them. */
  missing: string[];
}

const certainty = z.enum(['high', 'medium', 'low']);

/** The shape the model answers in: for each field, its value or nothing, and where it read it. */
function answerShape(fields: Record<string, z.ZodType>) {
  return z.object(
    Object.fromEntries(
      Object.entries(fields).map(([name, field]) => [
        name,
        z
          .object({
            found: z.boolean().describe('Whether the source says this field.'),
            // A value its field refuses is read as nothing: the rest of the reading stands.
            value: field
              .nullable()
              .catch(null)
              .describe('The value, exactly as the source gives it; null when not found.'),
            quote: z
              .string()
              .nullable()
              .describe(
                'The passage of the source it was read in, copied as written; null when not found.',
              ),
            certainty: certainty.describe('How sure the reading is: low when the text is unclear.'),
          })
          .describe(field.description ?? name),
      ]),
    ),
  );
}

const instructions =
  'Fill the fields of a record from what was received. For each field, give its value only when ' +
  'the source says it, copy the passage you read it in, and say how sure you are. Never guess, ' +
  'never compute a value the source does not write, never translate names. A field the source ' +
  'does not give is not found.';

function messagesOf(source: IntakeSource, context: string | undefined): ModelMessage[] {
  const intro = context ? `${context}\n\n` : '';
  if (source.kind === 'message') {
    return [{ role: 'user', content: `${intro}The message received:\n\n${source.text}` }];
  }
  if (source.kind === 'voice') {
    return [
      { role: 'user', content: `${intro}The voice note, transcribed:\n\n${source.transcript}` },
    ];
  }
  return [
    {
      role: 'user',
      content: [
        { type: 'text', text: `${intro}The ${source.kind} received:` },
        source.kind === 'photo' || source.contentType.startsWith('image/')
          ? { type: 'image', image: source.data, mediaType: source.contentType }
          : { type: 'file', data: source.data, mediaType: source.contentType },
      ],
    },
  ];
}

/**
 * Reads what was received into a record's fields (`schema`, the record's own zod object): each
 * value checked against its field, with its provenance. `by` is who read it — the reading agent,
 * acting for the person.
 */
export async function intake<Shape extends z.ZodRawShape>(options: {
  model: LanguageModel;
  schema: z.ZodObject<Shape>;
  source: IntakeSource;
  by: IntakeProvenance['by'];
  /** What the record is, in a sentence: « an expense note: what was paid, when, to whom ». */
  context?: string;
  evidence?: string;
  metering?: Metering;
}): Promise<Intake<z.output<z.ZodObject<Shape>>>> {
  const fields = options.schema.shape as unknown as Record<string, z.ZodType>;
  const { value } = await extract({
    model: options.model,
    schema: answerShape(fields),
    system: instructions,
    messages: messagesOf(options.source, options.context),
    ...(options.metering ? { metering: options.metering } : {}),
  });
  const read = value as Record<
    string,
    { found: boolean; value: unknown; quote: string | null; certainty: 'high' | 'medium' | 'low' }
  >;
  const values: Record<string, unknown> = {};
  const provenance: Record<string, IntakeProvenance> = {};
  const missing: string[] = [];
  for (const [name, field] of Object.entries(fields)) {
    const answer = read[name];
    // A value the field refuses is not a value: the person types it.
    const checked = answer?.found && answer.value !== null ? field.safeParse(answer.value) : null;
    if (!checked?.success || checked.data === undefined) {
      // Only what the record requires is missing; an optional field may stay empty.
      if (!field.safeParse(undefined).success) missing.push(name);
      continue;
    }
    values[name] = checked.data;
    provenance[name] = {
      source: options.source.kind,
      by: options.by,
      certainty: answer?.certainty ?? 'low',
      ...(answer?.quote ? { quote: answer.quote } : {}),
      ...(options.evidence ? { evidence: options.evidence } : {}),
    };
  }
  return { values: values as Partial<z.output<z.ZodObject<Shape>>>, provenance, missing };
}
