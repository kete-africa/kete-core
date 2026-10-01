import { cpSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface CreateAppOptions {
  /** lowercase, with hyphens: `nettio`, `kya-remote`. */
  name: string;
  /** `kete` for a Kete App, `workspace` for an enterprise's app. */
  design: 'kete' | 'workspace';
  /** Where the new app goes (it must not exist). */
  target: string;
  /** The template's folder. */
  template: string;
  /** The published version of each @kete-africa package, e.g. `{ sdk: '0.3.0' }`. */
  versions: Record<string, string>;
  /** The person or team that answers for the app: its manifest's identity card (doctrine D-040). */
  owner: { name: string; contact?: string };
}

/** What is never copied: what a build, an install or a person's machine produced. */
const skipped = [
  'node_modules',
  'dist',
  '.tanstack',
  `src${sep}paraglide`,
  `src${sep}routeTree.gen.ts`,
  `project.inlang${sep}cache`,
  `project.inlang${sep}.meta.json`,
  '.env',
];

function edit(path: string, change: (text: string) => string): void {
  writeFileSync(path, change(readFileSync(path, 'utf8')));
}

/**
 * A new Kete App, from the template: renamed, in its design, its @kete/* packages taken from the
 * registry at their published versions (doctrine D-034: never a branch of another lane).
 */
export function createApp(options: CreateAppOptions): void {
  const { name, design, target } = options;
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(name)) {
    throw new Error(`An app's name is lowercase, with hyphens: ${name}`);
  }
  if (!options.owner.name.trim()) {
    throw new Error(
      'An app has an owner from its first commit: the person or team that answers for it.',
    );
  }
  if (existsSync(target)) throw new Error(`${target} already exists.`);

  cpSync(options.template, target, {
    recursive: true,
    filter: (source) => {
      const path = relative(options.template, source);
      return !skipped.some((skip) => path === skip || path.startsWith(`${skip}${sep}`));
    },
  });
  // npm leaves out dot-files of packages: they travel under plain names.
  for (const file of ['npmrc', 'gitignore']) {
    if (existsSync(join(target, file))) renameSync(join(target, file), join(target, `.${file}`));
  }
  // Its pnpm settings (approved build scripts), kept under another name inside kete-core.
  if (existsSync(join(target, 'pnpm-workspace.app.yaml'))) {
    renameSync(join(target, 'pnpm-workspace.app.yaml'), join(target, 'pnpm-workspace.yaml'));
  }

  const product = `prd_${name.replaceAll('-', '_')}`;
  edit(join(target, 'package.json'), (text) => {
    const manifest = JSON.parse(text) as Record<string, unknown> & {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    manifest['name'] = `@kete/${name}`;
    manifest['description'] = `${name}: a Kete App.`;
    for (const group of [manifest.dependencies, manifest.devDependencies]) {
      for (const [dependency, version] of Object.entries(group)) {
        const local = /^workspace:@kete-africa\/([a-z-]+)@/.exec(version);
        if (!local?.[1]) continue;
        const published = options.versions[local[1]];
        if (!published) throw new Error(`No published version of @kete-africa/${local[1]}.`);
        group[dependency] = `npm:@kete-africa/${local[1]}@^${published}`;
      }
    }
    return `${JSON.stringify(manifest, null, 2)}\n`;
  });
  edit(join(target, 'kete.json'), (text) => {
    const manifest = JSON.parse(text) as Record<string, unknown> & {
      governance: Record<string, unknown>;
    };
    // Its identity card names who answers for it from the first commit (doctrine D-040).
    const governance = { ...manifest.governance, owner: options.owner };
    return `${JSON.stringify({ ...manifest, product, name, version: '0.1.0', governance }, null, 2)}\n`;
  });
  for (const locale of ['fr', 'en']) {
    edit(join(target, 'messages', `${locale}.json`), (text) => {
      const messages = JSON.parse(text) as Record<string, string>;
      return `${JSON.stringify({ ...messages, app_name: name }, null, 2)}\n`;
    });
  }
  edit(join(target, 'src', 'platform', 'app.ts'), (text) =>
    text.replace(
      "export const DESIGN: string = 'kete';",
      `export const DESIGN: string = '${design}';`,
    ),
  );
  edit(join(target, 'vitest.config.ts'), (text) =>
    text.replace("name: 'app-template'", `name: '${name}'`),
  );
  for (const doc of ['README.md', 'CLAUDE.md']) {
    edit(join(target, doc), (text) => text.replaceAll('App template', name));
  }
  edit(join(target, 'tests', 'app.test.ts'), (text) =>
    text.replace("product: 'prd_app_template'", `product: '${product}'`),
  );
}
