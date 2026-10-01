/**
 * Builds the site's content from the repository's own Markdown (decision 0006): the repository
 * stays the single source of truth, the site is a view of it. Each page gets its title from its
 * first heading, and every relative link is rewritten to the page's route on the site, or to the
 * file on GitHub when the file is not part of the site. The output is generated, never committed.
 *
 * Diátaxis: how-to guides, reference, explanation. Tutorials come with the app template.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = resolve(root, 'apps/docs/src/content/docs');
const github = 'https://github.com/kete-africa/kete-core/blob/dev';

interface Page {
  /** Repository path, with forward slashes. */
  source: string;
  /** Site route, without leading or trailing slash. */
  slug: string;
  /** Position in its sidebar group. */
  order?: number;
}

const toPosix = (path: string) => path.split('\\').join('/');
const list = (dir: string, match: RegExp) =>
  existsSync(resolve(root, dir))
    ? readdirSync(resolve(root, dir))
        .filter((name) => match.test(name))
        .sort()
    : [];

function pages(): Page[] {
  const result: Page[] = [
    { source: 'docs/OPERATIONS.md', slug: 'how-to/operations', order: 1 },
    { source: '.changeset/README.md', slug: 'how-to/release-packages', order: 2 },
    { source: 'docs/ARCHITECTURE.md', slug: 'explanation/architecture', order: 1 },
    { source: 'docs/ROADMAP.md', slug: 'explanation/roadmap', order: 2 },
    { source: 'docs/decisions/README.md', slug: 'explanation/decisions', order: 0 },
    { source: 'contracts/README.md', slug: 'reference/contracts', order: 0 },
    {
      source: 'packages/design/designs/kete/DESIGN.md',
      slug: 'reference/packages/design/kete',
      order: 1,
    },
    {
      source: 'packages/design/designs/workspace/DESIGN.md',
      slug: 'reference/packages/design/workspace',
      order: 2,
    },
  ];
  for (const name of list('docs/flows', /\.md$/)) {
    result.push({
      source: `docs/flows/${name}`,
      slug: `explanation/flows/${basename(name, '.md')}`,
    });
  }
  list('docs/decisions', /^\d{4}-.+\.md$/).forEach((name, index) => {
    result.push({
      source: `docs/decisions/${name}`,
      slug: `explanation/decisions/${basename(name, '.md')}`,
      order: index + 1,
    });
  });
  for (const name of list('packages', /^[a-z-]+$/)) {
    if (existsSync(resolve(root, `packages/${name}/README.md`))) {
      result.push({ source: `packages/${name}/README.md`, slug: `reference/packages/${name}` });
    }
  }
  for (const name of ['account']) {
    if (existsSync(resolve(root, `apps/${name}/README.md`))) {
      result.push({ source: `apps/${name}/README.md`, slug: `reference/apps/${name}` });
    }
  }
  return result;
}

/** Splits the first level-one heading from the body. */
function titleOf(markdown: string, fallback: string): { title: string; body: string } {
  const match = /^# (?<title>.+)$/m.exec(markdown);
  const title = match?.groups?.['title'];
  if (!match || !title) return { title: fallback, body: markdown };
  return {
    title: title.replace(/`/g, '').trim(),
    body: markdown.slice(0, match.index) + markdown.slice(match.index + match[0].length),
  };
}

function rewriteLinks(markdown: string, source: string, bySource: Map<string, Page>): string {
  return markdown.replace(/\]\(([^)\s]+)\)/g, (whole, target: string) => {
    if (/^[a-z]+:|^#|^\//i.test(target)) return whole;
    const [path, anchor] = target.split('#') as [string, string | undefined];
    const resolved = posix.normalize(posix.join(posix.dirname(source), path));
    const page = bySource.get(resolved);
    const hash = anchor ? `#${anchor}` : '';
    if (page) return `](/${page.slug}/${hash})`;
    return `](${github}/${resolved}${hash})`;
  });
}

/**
 * Reads a source file's own front matter (MADR decisions carry status, date and deciders) and
 * turns it into a line at the top of the page, since the site's front matter is Starlight's.
 */
function sourceFrontmatter(markdown: string): { meta: string; rest: string } {
  const text = markdown.replace(/\r\n/g, '\n');
  const match = /^---\n(?<block>[\s\S]*?)\n---\n/.exec(text);
  const block = match?.groups?.['block'];
  if (!match || block === undefined) return { meta: '', rest: markdown };
  const fields = block
    .split('\n')
    .map((line) => /^(?<key>[a-z-]+):\s*(?<value>.+)$/.exec(line.trim())?.groups)
    .filter((field): field is Record<string, string> => field !== undefined)
    .map((field) => `**${String(field['key']).replace('-', ' ')}**: ${field['value']}`);
  return { meta: fields.join(' · '), rest: text.slice(match[0].length) };
}

function frontmatter(fields: Record<string, string | number | undefined>): string {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) =>
      key === 'sidebar.order' ? `sidebar:\n  order: ${value}` : `${key}: ${JSON.stringify(value)}`,
    );
  return `---\n${lines.join('\n')}\n---\n`;
}

function write(slug: string, content: string): void {
  const file = resolve(out, `${slug}.md`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function contractPages(): void {
  for (const name of list('contracts', /\.schema\.json$/)) {
    const schema = JSON.parse(readFileSync(resolve(root, 'contracts', name), 'utf8')) as {
      title?: string;
      description?: string;
    };
    const id = basename(name, '.schema.json').replaceAll('.', '-');
    const body = [
      schema.description ?? '',
      '',
      `Source: [\`contracts/${name}\`](${github}/contracts/${name}) — JSON Schema, generated into`,
      "TypeScript types in `@kete/sdk`. The contracts' versioning rules are in the",
      '[contracts overview](/reference/contracts/).',
      '',
      '```json',
      JSON.stringify(schema, null, 2),
      '```',
      '',
    ].join('\n');
    write(`reference/contracts/${id}`, frontmatter({ title: schema.title ?? id }) + body);
  }
}

/** The event catalog, read from its AsyncAPI document: one row per event, its data fields. */
function eventsPage(): void {
  const source = 'docs/generated/events.asyncapi.json';
  if (!existsSync(resolve(root, source))) return;
  const catalog = JSON.parse(readFileSync(resolve(root, source), 'utf8')) as {
    info: { description: string };
    components: {
      messages: Record<
        string,
        {
          name: string;
          payload: {
            properties: {
              data: { properties?: Record<string, unknown>; required?: string[] };
            };
          };
        }
      >;
    };
  };
  const rows = Object.values(catalog.components.messages).map((message) => {
    const data = message.payload.properties.data;
    const required = new Set(data.required ?? []);
    const fields = Object.keys(data.properties ?? {})
      .map((name) => `\`${name}\`${required.has(name) ? '' : ' (optional)'}`)
      .join(', ');
    return `| \`${message.name}\` | ${fields || '—'} |`;
  });
  const body = [
    catalog.info.description,
    '',
    `The catalog is an [AsyncAPI 3.1 document](${github}/${source}), generated from the contracts`,
    'and checked in CI. Each event is wrapped in the [event envelope](/reference/contracts/event-v1/)',
    'and delivered in [signed batches](/reference/contracts/delivery-request-v1/).',
    '',
    '| Event | Data |',
    '| ----- | ---- |',
    ...rows,
    '',
  ].join('\n');
  write('reference/events', frontmatter({ title: 'Events' }) + body);
}

function homePage(): void {
  const body = `
The shared foundation of every Kete app: contracts, shared packages, the Compte Kete service with
Mon espace Kete, and the app template. This site is built from the repository itself: its
Markdown and its code are the source of truth.

- **How-to guides** — [run the services](/how-to/operations/), [release the packages](/how-to/release-packages/).
- **Reference** — [packages](/reference/packages/sdk/), [contracts](/reference/contracts/), [events](/reference/events/), and each package's API generated from its code.
- **Explanation** — [architecture](/explanation/architecture/), [roadmap](/explanation/roadmap/), [flows](/explanation/flows/event-delivery/), [decisions](/explanation/decisions/).

The doctrine behind it lives in the \`kete\` repository.
`;
  write('index', frontmatter({ title: 'Kete Core' }) + body.trimStart());
}

function main(): void {
  rmSync(out, { recursive: true, force: true });
  const all = pages();
  const bySource = new Map(all.map((page) => [page.source, page]));
  for (const page of all) {
    const { meta, rest } = sourceFrontmatter(readFileSync(resolve(root, page.source), 'utf8'));
    const { title, body } = titleOf(rest, basename(page.source));
    const edit = `${github}/${page.source}`;
    const content =
      frontmatter({ title, editUrl: edit, 'sidebar.order': page.order }) +
      (meta ? `\n${meta}\n` : '') +
      rewriteLinks(body, page.source, bySource).replace(/^\s+/, '\n');
    write(page.slug, content);
  }
  contractPages();
  eventsPage();
  homePage();
  console.log(`Synced ${all.length} pages into ${toPosix(relative(root, out))}.`);
}

main();
