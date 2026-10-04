import PizZip from 'pizzip';

// Minimal Office documents for the tests, written by hand: the parts each format requires, no more.

const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const pkg = 'http://schemas.openxmlformats.org/package/2006/relationships';
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function zip(files: Record<string, string>): Uint8Array {
  const z = new PizZip();
  for (const [name, content] of Object.entries(files)) z.file(name, content);
  return z.generate({ type: 'uint8array' });
}

const types = (overrides: Record<string, string>) =>
  `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${Object.entries(
    overrides,
  )
    .map(([part, type]) => `<Override PartName="${part}" ContentType="${type}"/>`)
    .join('')}</Types>`;

const relationships = (targets: [string, string, string][]) =>
  `${xml}<Relationships xmlns="${pkg}">${targets
    .map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`)
    .join('')}</Relationships>`;

/** A minimal Word document whose body is these paragraphs. */
export function word(...paragraphs: string[]): Uint8Array {
  return zip({
    '[Content_Types].xml': types({
      '/word/document.xml':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    }),
    '_rels/.rels': relationships([['rId1', `${rel}/officeDocument`, 'word/document.xml']]),
    'word/document.xml': `${xml}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs
      .map((p) => `<w:p><w:r><w:t xml:space="preserve">${escape(p)}</w:t></w:r></w:p>`)
      .join('')}</w:body></w:document>`,
  });
}

/** A minimal workbook: one sheet per entry, its rows of inline strings. */
export function workbook(sheets: Record<string, string[][]>): Uint8Array {
  const names = Object.keys(sheets);
  const files: Record<string, string> = {
    '[Content_Types].xml': types({
      '/xl/workbook.xml':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
      ...Object.fromEntries(
        names.map((_, i) => [
          `/xl/worksheets/sheet${i + 1}.xml`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml',
        ]),
      ),
    }),
    '_rels/.rels': relationships([['rId1', `${rel}/officeDocument`, 'xl/workbook.xml']]),
    'xl/workbook.xml': `${xml}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${rel}"><sheets>${names
      .map((n, i) => `<sheet name="${escape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': relationships(
      names.map((_, i) => [`rId${i + 1}`, `${rel}/worksheet`, `worksheets/sheet${i + 1}.xml`]),
    ),
  };
  names.forEach((name, i) => {
    const rows = sheets[name] ?? [];
    files[`xl/worksheets/sheet${i + 1}.xml`] =
      `${xml}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows
        .map(
          (cells, r) =>
            `<row r="${r + 1}">${cells
              .map(
                (c, k) =>
                  `<c r="${String.fromCharCode(65 + k)}${r + 1}" t="inlineStr"><is><t>${escape(c)}</t></is></c>`,
              )
              .join('')}</row>`,
        )
        .join('')}</sheetData></worksheet>`;
  });
  return zip(files);
}

/** A minimal presentation: one slide per entry, its paragraphs in one text box. */
export function presentation(slides: string[][]): Uint8Array {
  const p = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  const a = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const files: Record<string, string> = {
    '[Content_Types].xml': types({
      '/ppt/presentation.xml':
        'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
      ...Object.fromEntries(
        slides.map((_, i) => [
          `/ppt/slides/slide${i + 1}.xml`,
          'application/vnd.openxmlformats-officedocument.presentationml.slide+xml',
        ]),
      ),
    }),
    '_rels/.rels': relationships([['rId1', `${rel}/officeDocument`, 'ppt/presentation.xml']]),
    'ppt/presentation.xml': `${xml}<p:presentation xmlns:p="${p}" xmlns:r="${rel}"><p:sldIdLst>${slides
      .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`)
      .join('')}</p:sldIdLst></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': relationships(
      slides.map((_, i) => [`rId${i + 1}`, `${rel}/slide`, `slides/slide${i + 1}.xml`]),
    ),
  };
  slides.forEach((paragraphs, i) => {
    files[`ppt/slides/slide${i + 1}.xml`] =
      `${xml}<p:sld xmlns:p="${p}" xmlns:a="${a}"><p:cSld><p:spTree><p:sp><p:txBody>${paragraphs
        .map((t) => `<a:p><a:r><a:t>${escape(t)}</a:t></a:r></a:p>`)
        .join('')}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  });
  return zip(files);
}
