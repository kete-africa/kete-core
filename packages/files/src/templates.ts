import Docxtemplater from 'docxtemplater';
import inspectModule from 'docxtemplater/js/inspect-module.js';
import PizZip from 'pizzip';

/** docxtemplater's inspection module, which its types do not describe as a class. */
type Inspector = { getAllTags(): Record<string, unknown> };
const InspectModule = inspectModule as unknown as new () => Inspector;

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

/** The fields a template asks for, as its author wrote them (`client`, `lines.label`…). */
export function templateFields(template: Uint8Array): string[] {
  const inspect = new InspectModule();
  try {
    new Docxtemplater(open(template), {
      modules: [inspect as never],
      paragraphLoop: true,
      linebreaks: true,
    });
  } catch (error) {
    throw new TemplateError('invalid_template', (error as Error).message);
  }
  const tags = inspect.getAllTags() as Record<string, unknown>;
  const names: string[] = [];
  const walk = (node: Record<string, unknown>, prefix: string) => {
    for (const [key, value] of Object.entries(node)) {
      const name = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && Object.keys(value).length) {
        walk(value as Record<string, unknown>, name);
      } else names.push(name);
    }
  };
  walk(tags, '');
  return names.sort();
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
