import { describe, expect, it } from 'vitest';
import {
  ConversionError,
  EXCEL,
  fillTemplate,
  gotenbergConverter,
  pdfConverterFromEnv,
  POWERPOINT,
  readable,
  readDocument,
  TemplateError,
  templateFields,
  WORD,
} from '../src/index.js';
import { presentation, word, workbook } from './office-fixtures.js';

// Spec 053: documents read page by page, final documents from the company's Word templates, PDF
// through a conversion service.

/** A one-page PDF with no text: what a scanner without OCR produces, as far as text goes. */
function blankPdf(): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
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
  it('reads a workbook sheet by sheet and a presentation slide by slide', async () => {
    const sheets = await readDocument(
      EXCEL,
      workbook({
        Ventes: [
          ['Mois', 'Montant'],
          ['Janvier', '1200'],
        ],
        Stocks: [
          ['Article', 'Quantité'],
          ['Batterie', '14'],
        ],
      }),
    );
    expect(sheets).toMatchObject({ kind: 'text', pages: 2 });
    expect(sheets.pageTexts[0]).toBe('Ventes\nMois\tMontant\nJanvier\t1200');
    expect(sheets.pageTexts[1]).toContain('Batterie\t14');
    const slides = await readDocument(
      POWERPOINT,
      presentation([
        ['Revue SAV', 'Octobre'],
        ['Délais', '48 heures en moyenne'],
      ]),
    );
    expect(slides).toMatchObject({ kind: 'text', pages: 2 });
    expect(slides.pageTexts).toEqual(['Revue SAV\nOctobre', 'Délais\n48 heures en moyenne']);
    expect(readable('application/vnd.oasis.opendocument.text')).toBe(true);
  });

  it('gives a scan to the transcriber, and keeps an image as it is without one', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(await readDocument('image/png', png)).toMatchObject({ kind: 'image', text: '' });
    const seen: string[] = [];
    const transcribe = async (d: { contentType: string }) => {
      seen.push(d.contentType);
      return [' Bon de livraison n° 42 '];
    };
    expect(await readDocument('image/png', png, { transcribe })).toEqual({
      kind: 'text',
      text: 'Bon de livraison n° 42',
      pages: null,
      pageTexts: ['Bon de livraison n° 42'],
    });
    const scanned = await readDocument('application/pdf', blankPdf(), { transcribe });
    expect(scanned).toMatchObject({ kind: 'text', pages: 1, text: 'Bon de livraison n° 42' });
    expect(seen).toEqual(['image/png', 'application/pdf']);
    // Without a transcriber, a scanned PDF says it has a page and no text.
    expect(await readDocument('application/pdf', blankPdf())).toMatchObject({
      pages: 1,
      text: '',
    });
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
