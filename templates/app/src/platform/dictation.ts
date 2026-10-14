import {
  dictation,
  ModelConfigError,
  modelConfigFromEnv,
  transcriptionModel,
  type DictationPort,
} from '@kete/ai';

// The dictation port (@kete/ai, spec 090): what a person says, written down — by the transcription
// model the deployment chose, `KETE_DICTATION_PROVIDER` and `KETE_DICTATION_MODEL` (with
// `KETE_DICTATION_API_KEY`), never named in the code. Without one, the voice is not offered.

let override: DictationPort | null | undefined;

export function getDictation(): DictationPort | null {
  if (override !== undefined) return override;
  try {
    return dictation(transcriptionModel(modelConfigFromEnv('KETE_DICTATION')));
  } catch (error) {
    if (error instanceof ModelConfigError) return null;
    throw error;
  }
}

/** Tests: a scripted port, or none (`null`); `undefined` goes back to the configuration. */
export function useDictation(port: DictationPort | null | undefined): void {
  override = port;
}
