#!/usr/bin/env node
import { resolve } from 'node:path';
import { createApp } from './create.js';
import { packageVersions, templateFolder } from './sources.js';

// pnpm create @kete-africa/app <name> [--design kete|workspace]
const args = process.argv.slice(2);
const name = args.find((arg) => !arg.startsWith('--'));
const design =
  args.includes('--design=workspace') || args.includes('workspace') ? 'workspace' : 'kete';
if (!name) {
  console.error('Usage: pnpm create @kete-africa/app <name> [--design=workspace]');
  process.exit(1);
}
const target = resolve(name);
createApp({ name, design, target, template: templateFolder(), versions: packageVersions() });
console.log(`Created ${name} in ${target}.`);
console.log('Next: cd into it, cp .env.example .env, pnpm install, pnpm db:migrate, pnpm dev.');
