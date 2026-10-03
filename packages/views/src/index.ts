// The public entry point of @kete/views (doctrine D-037). Anything not exported here is internal.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { ViewResource } from '@kete/capabilities';
import { VIEWS, type ViewKind } from './contract.js';
export { exposeRecord, type ExposedColumn, type ExposeRecordOptions } from './expose.js';

export {
  detailView,
  formView,
  tableView,
  VIEWS,
  type DetailContent,
  type FormContent,
  type TableColumn,
  type TableContent,
  type ViewContent,
  type ViewKind,
} from './contract.js';

export interface KeteViewsOptions {
  /** The design the views wear: the product's (default `kete`). */
  design?: 'kete' | 'workspace';
  /** The origins the views may reach, beyond the host (none by default). */
  csp?: ViewResource['csp'];
}

// One page serves every generic view; it is built by `vite build` into dist/views.html.
const candidates = ['../dist/views.html', '../views.html'].map((path) =>
  fileURLToPath(new URL(path, import.meta.url)),
);

let page: Promise<string> | undefined;

function builtPage(): Promise<string> {
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error('@kete/views is not built: run `pnpm --filter @kete-africa/views build`.');
  }
  page ??= readFile(path, 'utf8');
  return page;
}

const descriptions: Record<ViewKind, string> = {
  review: 'A draft prepared by an agent, each value with its provenance, for a person to decide.',
  form: 'A form drawn from a schema.',
  table: 'A table.',
  detail: 'One record, field by field.',
};

/**
 * The generic views as MCP Apps resources, for `createMcpHandler({ views })` of
 * @kete/capabilities: `ui://kete/review` (a draft to verify, decided by the person in the view),
 * `ui://kete/form`, `ui://kete/table`, `ui://kete/detail`.
 */
export function keteViews(options: KeteViewsOptions = {}): ViewResource[] {
  const design = options.design ?? 'kete';
  return (Object.keys(VIEWS) as ViewKind[]).map((kind) => ({
    uri: VIEWS[kind],
    name: `kete-${kind}`,
    description: descriptions[kind],
    html: async () => (await builtPage()).replace('<html', `<html data-design="${design}"`),
    prefersBorder: true,
    ...(options.csp ? { csp: options.csp } : {}),
  }));
}
