import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

// Final documents from the company's own templates (spec 053), with docxtemplater: a Word file
// written by the company, with `{client}`, `{date}`, `{#lines}…{/lines}` where the values go. Its
// layout, header and logo stay the company's; only the values change.

export class TemplateError extends Error {
  constructor(
    readonly code: 'invalid_template' | 'unreadable',
    message: string,
  ) {
    super(message);
    this.name = 'TemplateError';
  }
}

function open(template: Uint8Array): PizZip {
  try {
    return new PizZip(template);
  } catch {
    throw new TemplateError('unreadable', 'This is not a Word document.');
  }
}

/**
 * The fields a template asks for, as its author wrote them (`client`, `lines.label`…): read by
 * rendering it once through docxtemplater's own parser hook, each loop visited once. (Its
 * inspection module needs lodash without declaring it, so it is not used.)
 */
export function templateFields(template: Uint8Array): string[] {
  const leaves = new Set<string>();
  const loops = new Set<string>();
  try {
    const doc = new Docxtemplater(open(template), {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
      parser: (tag: string) => ({
        get(
          _scope: unknown,
          context: { scopePath?: string[]; meta?: { part?: { module?: string } } },
        ) {
          if (tag === '.' || !tag.trim()) return '';
          const name = [...(context.scopePath ?? []), tag.trim()].join('.');
          if (context.meta?.part?.module === 'loop') {
            loops.add(name);
            return [{}];
          }
          leaves.add(name);
          return '';
        },
      }),
    });
    doc.render({});
  } catch (error) {
    throw new TemplateError('invalid_template', (error as Error).message);
  }
  // A loop without fields inside is a field of its own (a condition, a list of text).
  for (const loop of loops) {
    if (![...leaves].some((leaf) => leaf.startsWith(`${loop}.`))) leaves.add(loop);
  }
  return [...leaves].sort();
}

/**
 * The template filled with its values; a value left out stays empty, never « undefined ». Line
 * breaks in a value become line breaks in the document.
 */
export function fillTemplate(template: Uint8Array, values: Record<string, unknown>): Uint8Array {
  try {
    const doc = new Docxtemplater(open(template), {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });
    doc.render(values);
    return doc.getZip().generate({ type: 'uint8array', compression: 'DEFLATE' });
  } catch (error) {
    if (error instanceof TemplateError) throw error;
    throw new TemplateError('invalid_template', (error as Error).message);
  }
}
