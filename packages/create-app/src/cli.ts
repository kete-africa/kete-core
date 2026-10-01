#!/usr/bin/env node
import { resolve } from 'node:path';
import { createApp } from './create.js';
import { packageVersions, templateFolder } from './sources.js';

// pnpm create @kete-africa/app <name> --owner="<person or team>" [--contact=<e-mail>] [--design=workspace]
const usage =
  'Usage: pnpm create @kete-africa/app <name> --owner="<person or team>" [--contact=<e-mail>] [--design=workspace]';
const args = process.argv.slice(2);
const option = (key: string) =>
  args.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
const name = args.find((arg) => !arg.startsWith('--'));
const design =
  args.includes('--design=workspace') || args.includes('workspace') ? 'workspace' : 'kete';
// An app has an owner from its first commit (doctrine D-040).
const owner = option('owner');
const contact = option('contact');
if (!name || !owner) {
  console.error(usage);
  process.exit(1);
}
const target = resolve(name);
createApp({
  name,
  design,
  target,
  template: templateFolder(),
  versions: packageVersions(),
  owner: contact ? { name: owner, contact } : { name: owner },
});
console.log(`Created ${name} in ${target}.`);
console.log('Next: cd into it, cp .env.example .env, pnpm install, pnpm db:migrate, pnpm dev.');
