// PDF from a Word document, an HTML page or Markdown (spec 053), through Gotenberg — the open
// conversion service (LibreOffice and Chromium in a container), reached over HTTP behind a port.

export interface PdfConverter {
  fromWord(document: Uint8Array): Promise<Uint8Array>;
  fromHtml(html: string): Promise<Uint8Array>;
  fromMarkdown(markdown: string, options?: { title?: string }): Promise<Uint8Array>;
}

export class ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversionError';
  }
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A plain page around Markdown: readable fonts and margins, the title in the document's head. */
const markdownPage = (title: string) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${escape(title)}</title>
<style>body{font-family:"Segoe UI",Arial,sans-serif;font-size:11pt;line-height:1.5;color:#1f1f1f;margin:2cm}
h1,h2,h3{line-height:1.25}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 8px}</style>
</head><body>{{ toHTML "content.md" }}</body></html>`;

export function gotenbergConverter(options: {
  url: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): PdfConverter {
  const base = options.url.replace(/\/$/, '');
  const http = options.fetch ?? fetch;
  const post = async (route: string, files: [string, Blob][]): Promise<Uint8Array> => {
    const form = new FormData();
    for (const [name, blob] of files) form.append('files', blob, name);
    const response = await http(`${base}${route}`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
    }).catch((error: unknown) => {
      throw new ConversionError(
        `The conversion service does not answer: ${(error as Error).message}`,
      );
    });
    if (!response.ok) throw new ConversionError(`The conversion failed: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  };
  return {
    fromWord: (document) =>
      post('/forms/libreoffice/convert', [['document.docx', new Blob([new Uint8Array(document)])]]),
    fromHtml: (html) =>
      post('/forms/chromium/convert/html', [
        ['index.html', new Blob([html], { type: 'text/html' })],
      ]),
    fromMarkdown: (markdown, opts) =>
      post('/forms/chromium/convert/markdown', [
        ['index.html', new Blob([markdownPage(opts?.title ?? 'Document')], { type: 'text/html' })],
        ['content.md', new Blob([markdown], { type: 'text/markdown' })],
      ]),
  };
}

/** The converter the environment names (`KETE_GOTENBERG_URL`); null when none is configured. */
export function pdfConverterFromEnv(env: NodeJS.ProcessEnv = process.env): PdfConverter | null {
  const url = env.KETE_GOTENBERG_URL?.trim();
  return url ? gotenbergConverter({ url }) : null;
}
