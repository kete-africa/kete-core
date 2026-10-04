import { OfficeGenerator, OfficeParser, type OfficeParserAST } from 'officeparser';
import { extractText } from 'unpdf';

// What a document says, read with existing libraries (spec 053): PDF (unpdf); Word, Excel,
// PowerPoint, OpenDocument and RTF (officeparser); plain text, CSV, Markdown, JSON — page by page
// when the document has pages (a PDF's pages, a workbook's sheets, a presentation's slides), so
// that a citation names its page. An image is kept as it is: a model reads it. A scan — an image,
// or a PDF without text — is read by the transcriber the caller gives, when it gives one.

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

/** Reads a scan (an image, or a PDF without text) and answers its text page by page. */
export type Transcriber = (document: {
  data: Uint8Array;
  contentType: string;
}) => Promise<string[]>;

export interface ReadOptions {
  /** Who reads scans; without one, an image stays an image and a scanned PDF has no text. */
  transcribe?: Transcriber;
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
export const EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const POWERPOINT =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const office = new Map<string, 'docx' | 'xlsx' | 'pptx' | 'odt' | 'ods' | 'odp' | 'rtf'>([
  [WORD, 'docx'],
  [EXCEL, 'xlsx'],
  [POWERPOINT, 'pptx'],
  ['application/vnd.oasis.opendocument.text', 'odt'],
  ['application/vnd.oasis.opendocument.spreadsheet', 'ods'],
  ['application/vnd.oasis.opendocument.presentation', 'odp'],
  ['application/rtf', 'rtf'],
  ['text/rtf', 'rtf'],
]);

/** A PDF whose pages hold less text than this, on average, is taken for a scan. */
const SCAN_CHARACTERS_PER_PAGE = 20;

/** Whether this kind of file is read. */
export function readable(contentType: string): boolean {
  return (
    images.has(contentType) ||
    texts.has(contentType) ||
    contentType === 'application/pdf' ||
    office.has(contentType)
  );
}

const textOf = async (ast: OfficeParserAST): Promise<string> => {
  const { value } = await OfficeGenerator.generate(ast, 'text', {
    includeImages: false,
    textConfig: { preserveLayout: false },
  } as never);
  return String(value).trim();
};

/** An Office document's text; a workbook's sheets and a presentation's slides as its pages. */
async function readOffice(
  fileType: NonNullable<ReturnType<typeof office.get>>,
  data: Uint8Array,
): Promise<ReadDocument> {
  const ast = await OfficeParser.parseOffice(new Uint8Array(data), {
    fileType,
    ignoreComments: true,
  });
  const paged =
    ast.content.length > 0 && ast.content.every((n) => n.type === 'sheet' || n.type === 'slide');
  if (!paged) {
    const text = await textOf(ast);
    return { kind: 'text', text, pages: null, pageTexts: [text] };
  }
  const pageTexts = await Promise.all(
    ast.content.map(async (node) => {
      const body = await textOf({ ...ast, content: [node] } as OfficeParserAST);
      const name = node.metadata && 'sheetName' in node.metadata ? node.metadata.sheetName : null;
      return typeof name === 'string' && name ? `${name}\n${body}` : body;
    }),
  );
  return {
    kind: 'text',
    text: pageTexts.join('\n\n').trim(),
    pages: pageTexts.length,
    pageTexts,
  };
}

const transcribed = async (
  transcribe: Transcriber,
  contentType: string,
  data: Uint8Array,
): Promise<ReadDocument> => {
  const pageTexts = (await transcribe({ data, contentType })).map((t) => t.trim());
  return {
    kind: 'text',
    text: pageTexts.join('\n\n').trim(),
    pages: contentType === 'application/pdf' ? pageTexts.length : null,
    pageTexts,
  };
};

export async function readDocument(
  contentType: string,
  data: Uint8Array,
  options: ReadOptions = {},
): Promise<ReadDocument> {
  if (images.has(contentType)) {
    if (options.transcribe) return transcribed(options.transcribe, contentType, data);
    return { kind: 'image', text: '', pages: null, pageTexts: [] };
  }
  if (contentType === 'application/pdf') {
    const { totalPages, text } = await extractText(new Uint8Array(data), { mergePages: false });
    const pageTexts = (text as string[]).map((t) => String(t).trim());
    const characters = pageTexts.reduce((sum, t) => sum + t.length, 0);
    if (options.transcribe && characters < SCAN_CHARACTERS_PER_PAGE * Math.max(totalPages, 1)) {
      return transcribed(options.transcribe, contentType, data);
    }
    return { kind: 'text', text: pageTexts.join('\n\n').trim(), pages: totalPages, pageTexts };
  }
  const fileType = office.get(contentType);
  if (fileType) return readOffice(fileType, data);
  const text = Buffer.from(data).toString('utf8').trim();
  return { kind: 'text', text, pages: null, pageTexts: [text] };
}
