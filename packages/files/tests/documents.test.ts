import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';
import {
  ConversionError,
  fillTemplate,
  gotenbergConverter,
  pdfConverterFromEnv,
  readable,
  readDocument,
  TemplateError,
  templateFields,
  WORD,
} from '../src/index.js';

// Spec 053: documents read page by page, final documents from the company's Word templates, PDF
// through a conversion service.

/** A minimal Word document whose body is these paragraphs. */
function word(...paragraphs: string[]): Uint8Array {
  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs
      .map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`)
      .join('')}</w:body></w:document>`,
  );
  return zip.generate({ type: 'uint8array' });
}

const letter = word(
  'Objet : remplacement des batteries',
  'Madame {client},',
  'Intervention le {date}.',
  '{#lines}- {label}{/lines}',
);

describe('reading', () => {
  it('reads text and Word, and says what it reads', async () => {
    expect(readable('application/pdf')).toBe(true);
    expect(readable('application/zip')).toBe(false);
    expect(await readDocument('text/plain', new TextEncoder().encode(' Bonjour '))).toEqual({
      kind: 'text',
      text: 'Bonjour',
      pages: null,
      pageTexts: ['Bonjour'],
    });
    const read = await readDocument(WORD, word('Procédure qualité', 'Fiche sous 48 heures.'));
    expect(read.text).toContain('Fiche sous 48 heures.');
  });
});

describe('templates', () => {
  it('lists the fields a template asks for', () => {
    expect(templateFields(letter)).toEqual(['client', 'date', 'lines.label']);
  });

  it('fills a template, leaving a missing value empty', async () => {
    const filled = fillTemplate(letter, {
      client: 'Ayivi',
      lines: [{ label: '12 batteries 200 Ah' }, { label: 'Main-d\u2019œuvre' }],
    });
    const text = (await readDocument(WORD, filled)).text;
    expect(text).toContain('Madame Ayivi,');
    expect(text).toContain('- 12 batteries 200 Ah');
    expect(text).toContain('Intervention le .');
    expect(text).not.toContain('undefined');
  });

  it('refuses what is not a template', () => {
    expect(() => fillTemplate(new TextEncoder().encode('pas un docx'), {})).toThrow(TemplateError);
    expect(() => templateFields(word('Madame {client'))).toThrow(TemplateError);
  });
});

describe('PDF', () => {
  it('sends the document to the conversion service, and says when it fails', async () => {
    const calls: { url: string; names: string[] }[] = [];
    const fake = (async (url: string | URL, init?: RequestInit) => {
      const form = init?.body as FormData;
      calls.push({ url: String(url), names: form.getAll('files').map((f) => (f as File).name) });
      return String(url).includes('html')
        ? new Response('nope', { status: 500 })
        : new Response(new Uint8Array([37, 80, 68, 70]));
    }) as typeof fetch;
    const pdf = gotenbergConverter({ url: 'https://gotenberg.test/', fetch: fake });
    expect(await pdf.fromMarkdown('# Lettre', { title: 'Lettre' })).toEqual(
      new Uint8Array([37, 80, 68, 70]),
    );
    await pdf.fromWord(letter);
    expect(calls).toEqual([
      {
        url: 'https://gotenberg.test/forms/chromium/convert/markdown',
        names: ['index.html', 'content.md'],
      },
      { url: 'https://gotenberg.test/forms/libreoffice/convert', names: ['document.docx'] },
    ]);
    await expect(pdf.fromHtml('<p>x</p>')).rejects.toBeInstanceOf(ConversionError);
    expect(pdfConverterFromEnv({})).toBeNull();
  });
});
