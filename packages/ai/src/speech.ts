import { generateSpeech, type SpeechModel } from 'ai';
import type { Metering } from './ask.js';

// The speech port (spec 129): an answer said aloud. Any speech model of the AI SDK fits it —
// OpenAI's, Mistral's Voxtral (open weights, which a deployment may host itself) — chosen by
// configuration, never named in business code. Like dictation, a call is checked against the
// budgets before it is made and counted after it.

/** An answer said aloud: the audio, and what it is. */
export interface Spoken {
  audio: Uint8Array;
  /** `audio/mpeg`, `audio/wav`… */
  mediaType: string;
}

export interface SpeechPort {
  speak(
    text: string,
    options?: { voice?: string; language?: string; signal?: AbortSignal },
  ): Promise<Spoken>;
}

/** The longest text said in one call: beyond, an answer is cut at a sentence. */
export const SPEECH_LIMIT = 4000;

const modelName = (model: SpeechModel) =>
  typeof model === 'string' ? model : `${model.provider}:${model.modelId}`;

/** What is said of a long answer: whole sentences up to the limit. */
export function sayable(text: string, limit = SPEECH_LIMIT): string {
  const plain = text
    // What a page shows but a voice does not say: links, code, emphasis.
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= limit) return plain;
  const cut = plain.slice(0, limit);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return end > limit / 2 ? cut.slice(0, end + 1) : cut;
}

/** The speech port on a speech model, metered. */
export function speech(model: SpeechModel, metering?: Metering): SpeechPort {
  return {
    async speak(text, options = {}) {
      await metering?.store.check(metering.context);
      const result = await generateSpeech({
        model,
        text: sayable(text),
        outputFormat: 'mp3',
        ...(options.voice ? { voice: options.voice } : {}),
        ...(options.language ? { language: options.language } : {}),
        ...(options.signal ? { abortSignal: options.signal } : {}),
      });
      await metering?.store.record(
        { ...metering.context, model: modelName(model) },
        { inputTokens: 0, outputTokens: 0, modelCalls: 1 },
      );
      return { audio: result.audio.uint8Array, mediaType: result.audio.mediaType };
    },
  };
}
