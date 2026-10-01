import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** The template: packed beside the published package, or kete-core's own in the workspace. */
export function templateFolder(): string {
  for (const candidate of ['../template', '../../template', '../../../templates/app']) {
    const folder = here(candidate);
    if (existsSync(`${folder}/kete.json`)) return folder;
  }
  throw new Error('The Kete App template is missing.');
}

/** The published version of each package: packed beside the package, or read in the workspace. */
export function packageVersions(): Record<string, string> {
  for (const candidate of ['../versions.json', '../../versions.json']) {
    const file = here(candidate);
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
  }
  const packages = here('../../');
  const versions: Record<string, string> = {};
  for (const name of readdirSync(packages)) {
    const manifest = `${packages}/${name}/package.json`;
    if (!existsSync(manifest)) continue;
    const { name: full, version } = JSON.parse(readFileSync(manifest, 'utf8')) as {
      name: string;
      version: string;
    };
    if (full.startsWith('@kete-africa/')) versions[full.slice('@kete-africa/'.length)] = version;
  }
  return versions;
}
