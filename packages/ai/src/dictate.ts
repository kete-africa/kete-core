import { NoTranscriptGeneratedError, transcribe, type TranscriptionModel } from 'ai';
import type { Metering } from './ask.js';

// The dictation port (spec 090): what a person said, as text. Any transcription model of the AI
// SDK fits it — OpenAI's, Mistral's Voxtral (open weights, which a deployment may host itself) —
// chosen by configuration, never named in business code. A call is checked against the budgets
// before it is made, and counted after it, heard or not.

/** What a person said, written down; empty when nothing was heard. */
export interface Dictated {
  text: string;
  /** The language the model heard, when it says. */
  language: string | null;
  /** How long the recording lasted, in seconds, when the model says. */
  seconds: number | null;
}

export interface DictationPort {
  dictate(
    audio: Uint8Array,
    options?: { language?: string; signal?: AbortSignal },
  ): Promise<Dictated>;
}

const modelName = (model: TranscriptionModel) =>
  typeof model === 'string' ? model : `${model.provider}:${model.modelId}`;

/** The dictation port on a transcription model, metered. */
export function dictation(model: TranscriptionModel, metering?: Metering): DictationPort {
  return {
    async dictate(audio, options = {}) {
      await metering?.store.check(metering.context);
      let said: Dictated;
      try {
        const result = await transcribe({
          model,
          audio,
          ...(options.language
            ? { providerOptions: { openai: { language: options.language } } }
            : {}),
          ...(options.signal ? { abortSignal: options.signal } : {}),
        });
        said = {
          text: result.text.trim(),
          language: result.language ?? null,
          seconds: result.durationInSeconds ?? null,
        };
      } catch (error) {
        // A recording with no word in it is heard as nothing, not as a failure.
        if (!NoTranscriptGeneratedError.isInstance(error)) throw error;
        said = { text: '', language: null, seconds: null };
      }
      // The call was made, heard or not: it is counted.
      await metering?.store.record(
        { ...metering.context, model: modelName(model) },
        { inputTokens: 0, outputTokens: 0, modelCalls: 1 },
      );
      return said;
    },
  };
}
