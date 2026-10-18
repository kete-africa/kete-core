/**
 * Every package that depends on one being released is released with it (`pnpm release:version`).
 *
 * The packages depend on each other through aliases (`"@kete/ai": "workspace:@kete-africa/ai@*"`),
 * which Changesets does not see as internal links: a dependent was not bumped, kept pinning the
 * version of the day it was last published, and an app installed two copies of a package — two
 * `CapabilityDefinition` types that do not match. Before `changeset version`, this writes one more
 * changeset: a patch for each package that depends, directly or not, on one already planned.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');
const changesets = join(root, '.changeset');
const OUT = 'release-dependents.md';

interface Manifest {
  name: string;
  private?: boolean;
  publishConfig?: unknown;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const manifests = readdirSync(join(root, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry): Manifest[] => {
    try {
      return [JSON.parse(readFileSync(join(root, 'packages', entry.name, 'package.json'), 'utf8'))];
    } catch {
      return [];
    }
  })
  .filter((manifest) => !manifest.private && manifest.publishConfig);

/** Who depends on whom: a published name, and the published names it depends on. */
const dependsOn = new Map(
  manifests.map((manifest) => [
    manifest.name,
    Object.values({ ...manifest.dependencies, ...manifest.peerDependencies }).flatMap((range) => {
      const aliased = /^workspace:(@kete-africa\/[a-z0-9-]+)@/.exec(range);
      return aliased?.[1] ? [aliased[1]] : [];
    }),
  ]),
);

/** The packages the pending changesets already release (this script's own file aside). */
const planned = new Set<string>();
for (const file of readdirSync(changesets)) {
  if (!file.endsWith('.md') || file === 'README.md' || file === OUT) continue;
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(join(changesets, file), 'utf8'));
  for (const line of head?.[1]?.split(/\r?\n/) ?? []) {
    const name = /^['"]?(@kete-africa\/[a-z0-9-]+)['"]?\s*:/.exec(line.trim())?.[1];
    if (name) planned.add(name);
  }
}

// Every dependent, directly or not, of what is planned.
const released = new Set(planned);
for (let grew = true; grew;) {
  grew = false;
  for (const [name, deps] of dependsOn) {
    if (!released.has(name) && deps.some((dep) => released.has(dep))) {
      released.add(name);
      grew = true;
    }
  }
}
const added = [...released].filter((name) => !planned.has(name)).sort();

if (added.length === 0) {
  console.log('No dependent to add.');
} else {
  writeFileSync(
    join(changesets, OUT),
    `---\n${added.map((name) => `'${name}': patch`).join('\n')}\n---\n\nPublished again on the current versions of the packages it depends on.\n`,
  );
  console.log(`Dependents released with them: ${added.join(', ')}`);
}
