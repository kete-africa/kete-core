import { cpSync, existsSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { packageVersions } from '../src/sources.js';

// Before publishing: the template and the packages' versions travel inside the package.
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const template = here('../template');
rmSync(template, { recursive: true, force: true });
cpSync(here('../../../templates/app'), template, {
  recursive: true,
  filter: (source) => !/[\\/](node_modules|dist|\.tanstack|paraglide)([\\/]|$)/.test(source),
});
// npm leaves out dot-files: they travel under plain names, restored by createApp.
if (existsSync(`${template}/.gitignore`))
  renameSync(`${template}/.gitignore`, `${template}/gitignore`);
writeFileSync(here('../versions.json'), `${JSON.stringify(packageVersions(), null, 2)}\n`);
