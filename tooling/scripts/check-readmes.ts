/** Every package has a README.md (doctrine D-017). */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const packagesDir = join(import.meta.dirname, '..', '..', 'packages');
const missing = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !existsSync(join(packagesDir, entry.name, 'README.md')))
  .map((entry) => entry.name);

if (missing.length > 0) {
  console.error(`Packages without README.md: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('Every package has a README.md.');
