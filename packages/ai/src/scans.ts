import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { extract, type Metering } from './ask.js';

// A scan read by a multimodal model (spec 053): an image or a PDF without text, transcribed page
// by page. It is the transcriber `@kete/files`' `readDocument` takes — the same shape, without
// either package depending on the other.

const pages = z.object({
  pages: z.array(z.string()).describe('The text of each page, in order; one entry for an image.'),
});

const instructions =
  'Transcribe this document exactly as it is written: every word, number and table, in its own ' +
  'language, page by page. Write tables as Markdown tables. Add nothing, summarize nothing, ' +
  'correct nothing; write [illegible] where a passage cannot be read.';

/** A transcriber for `readDocument`: what the model reads in a scan, page by page, metered. */
export function scanReader(options: { model: LanguageModel; metering?: Metering }) {
  return async (document: { data: Uint8Array; contentType: string }): Promise<string[]> => {
    const { value } = await extract({
      model: options.model,
      schema: pages,
      system: instructions,
      messages: [
        {
          role: 'user',
          content: [
            document.contentType.startsWith('image/')
              ? { type: 'image', image: document.data, mediaType: document.contentType }
              : { type: 'file', data: document.data, mediaType: document.contentType },
          ],
        },
      ],
      ...(options.metering ? { metering: options.metering } : {}),
    });
    return value.pages;
  };
}
