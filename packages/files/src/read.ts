import mammoth from 'mammoth';
import { extractText } from 'unpdf';

// What a document says, read with existing libraries (spec 053): PDF (unpdf), Word (mammoth),
// plain text, CSV, Markdown, JSON — page by page when the document has pages, so that a citation
// names its page. An image is kept as it is: a model reads it.

export type ReadKind = 'text' | 'image';

export interface ReadDocument {
  kind: ReadKind;
  /** The whole text (empty for an image). */
  text: string;
  /** The number of pages, when the document has pages. */
  pages: number | null;
  /** The text page by page (one entry when the document has no pages). */
  pageTexts: string[];
}

const images = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const texts = new Set([
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'text/tab-separated-values',
]);
export const WORD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Whether this kind of file is read. */
export function readable(contentType: string): boolean {
  return (
    images.has(contentType) ||
    texts.has(contentType) ||
    contentType === 'application/pdf' ||
    contentType === WORD
  );
}

export async function readDocument(contentType: string, data: Uint8Array): Promise<ReadDocument> {
  if (images.has(contentType)) return { kind: 'image', text: '', pages: null, pageTexts: [] };
  if (contentType === 'application/pdf') {
    const { totalPages, text } = await extractText(new Uint8Array(data), { mergePages: false });
    const pageTexts = (text as string[]).map((t) => String(t).trim());
    return { kind: 'text', text: pageTexts.join('\n\n').trim(), pages: totalPages, pageTexts };
  }
  if (contentType === WORD) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(data) });
    return { kind: 'text', text: value.trim(), pages: null, pageTexts: [value.trim()] };
  }
  const text = Buffer.from(data).toString('utf8').trim();
  return { kind: 'text', text, pages: null, pageTexts: [text] };
}
