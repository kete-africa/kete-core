/**
 * Builds the shared packages and packs each one into a versioned tarball, for Kete apps that live
 * in their own repository (decision 0005): they vendor the tarballs and pin them by checksum.
 *
 *   pnpm packages:pack [--out <directory>]      default: ../firmo/vendor/kete
 *
 * Writes `kete-packages.json` next to the tarballs: the kete-core commit, and each tarball's
 * version and SHA-256. Refuses to pack from a dirty working tree, so a tarball always matches a
 * commit.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PACKAGES = ['sdk', 'auth', 'files', 'payments', 'design'];

const root = resolve(import.meta.dirname, '../..');
const outArg = process.argv.indexOf('--out');
const out = resolve(root, outArg > 0 ? (process.argv[outArg + 1] ?? '') : '../firmo/vendor/kete');

const run = (command: string, args: string[], cwd = root) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });

if (run('git', ['status', '--porcelain']).trim() && !process.argv.includes('--allow-dirty')) {
  throw new Error('Commit first: a packed tarball must match a kete-core commit.');
}
const commit = run('git', ['rev-parse', 'HEAD']).trim();

run('pnpm', ['exec', 'tsc', '-b']);
mkdirSync(out, { recursive: true });
for (const file of readdirSync(out)) if (file.endsWith('.tgz')) rmSync(join(out, file));

const packed: Record<string, { version: string; file: string; sha256: string }> = {};
for (const name of PACKAGES) {
  const dir = join(root, 'packages', name);
  const { name: pkg, version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
    name: string;
    version: string;
  };
  run('pnpm', ['pack', '--pack-destination', out], dir);
  const file = `kete-${name}-${version}.tgz`;
  const sha256 = createHash('sha256')
    .update(readFileSync(join(out, file)))
    .digest('hex');
  packed[pkg] = { version, file, sha256 };
}

writeFileSync(
  join(out, 'kete-packages.json'),
  `${JSON.stringify({ source: 'kete-africa/kete-core', commit, packages: packed }, null, 2)}\n`,
);
console.log(`Packed ${PACKAGES.length} packages from ${commit.slice(0, 7)} into ${out}`);
