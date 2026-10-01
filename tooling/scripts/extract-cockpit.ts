/**
 * Kete Cockpit leaves kete-core for its own repository, with its history (doctrine D-033, spec 030):
 *
 *   pnpm cockpit:extract --ref origin/dev --out ../kete-cockpit [--install] [--push]
 *
 * 1. `git subtree split` keeps every commit that touched apps/cockpit, as the new repository's root;
 * 2. one commit adapts it to stand alone: its @kete/* packages from GitHub Packages at their
 *    published versions, its TypeScript options inlined, its own Dockerfile, CI, .npmrc and context;
 *    its end-to-end test, which builds the Compte Kete from source, waits in e2e-pending/;
 * 3. `--install` writes its lockfile (once the packages are published); `--push` creates
 *    kete-africa/kete-cockpit (private) and pushes — both only when asked.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const args = process.argv.slice(2);
const option = (name: string, fallback?: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
const ref = option('ref', 'origin/dev') as string;
const out = resolve(option('out', join(root, '..', 'kete-cockpit')) as string);
const git = (cwd: string, ...gitArgs: string[]) =>
  execFileSync('git', gitArgs, { cwd, encoding: 'utf8' }).trim();
const run = (cwd: string, command: string, commandArgs: string[]) =>
  execFileSync(command, commandArgs, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

if (existsSync(out) && readdirSync(out).length > 0) throw new Error(`${out} is not empty.`);

// 1. The history.
const split = git(root, 'subtree', 'split', `--prefix=apps/cockpit`, ref);
const branch = `cockpit-split-${split.slice(0, 8)}`;
git(root, 'branch', '-f', branch, split);
mkdirSync(out, { recursive: true });
git(out, 'init', '--initial-branch=main');
git(out, 'pull', '--quiet', root, branch);
git(root, 'branch', '-D', branch);

// 2. Standing alone.
const versions: Record<string, string> = {};
for (const name of readdirSync(join(root, 'packages'))) {
  const manifest = join(root, 'packages', name, 'package.json');
  if (!existsSync(manifest)) continue;
  const { name: full, version } = JSON.parse(readFileSync(manifest, 'utf8')) as {
    name: string;
    version: string;
  };
  versions[full] = version;
}
const edit = (file: string, change: (text: string) => string) =>
  writeFileSync(join(out, file), change(readFileSync(join(out, file), 'utf8')));

edit('package.json', (text) => {
  const manifest = JSON.parse(text) as Record<string, Record<string, string>>;
  for (const group of ['dependencies', 'devDependencies']) {
    for (const [dependency, version] of Object.entries(manifest[group] ?? {})) {
      const local = /^workspace:(@kete-africa\/[a-z-]+)@/.exec(version);
      if (!local?.[1]) continue;
      (manifest[group] as Record<string, string>)[dependency] =
        `npm:${local[1]}@^${versions[local[1]] ?? '0.0.0'}`;
    }
  }
  delete (manifest as Record<string, unknown>)['scripts']?.['test:e2e' as never];
  // What kete-core's workspace root used to provide.
  (manifest['devDependencies'] ??= {})['@types/node'] ??= '^22.20.4';
  return `${JSON.stringify(manifest, null, 2)}\n`;
});

const base = JSON.parse(readFileSync(join(root, 'tooling', 'tsconfig', 'base.json'), 'utf8')) as {
  compilerOptions: Record<string, unknown>;
};
edit('tsconfig.json', (text) => {
  const config = JSON.parse(text) as {
    compilerOptions: Record<string, unknown>;
    include: string[];
    extends?: string;
  };
  delete config.extends;
  config.compilerOptions = { ...base.compilerOptions, ...config.compilerOptions };
  config.include = config.include.filter(
    (entry) => entry !== 'e2e' && entry !== 'playwright.config.ts',
  );
  return `${JSON.stringify(config, null, 2)}\n`;
});

edit('tests/setup.ts', (text) => text.replace("'../../../.env'", "'../.env'"));

// The end-to-end test builds and runs the Compte Kete from kete-core's sources: it waits for the
// Compte Kete's published image.
mkdirSync(join(out, 'e2e-pending'), { recursive: true });
renameSync(join(out, 'e2e'), join(out, 'e2e-pending', 'e2e'));
renameSync(join(out, 'playwright.config.ts'), join(out, 'e2e-pending', 'playwright.config.ts'));
writeFileSync(
  join(out, 'e2e-pending', 'README.md'),
  `# End-to-end, pending

In kete-core, this test built and served the Compte Kete from its sources. Here, it waits for the
Compte Kete's published image: the test then starts it (\`docker run\`) on the Compte Kete's Neon
"test" branch, and runs as before.
`,
);

writeFileSync(
  join(out, '.dockerignore'),
  [
    'node_modules',
    'dist',
    '.tanstack',
    '.env',
    '.env.*',
    '!.env.example',
    'test-results',
    'playwright-report',
    'src/paraglide',
    'src/routeTree.gen.ts',
    'project.inlang/cache',
    '.git',
    '',
  ].join('\n'),
);

writeFileSync(
  join(out, 'pnpm-workspace.yaml'),
  '# pnpm settings of this repository. Build scripts run only when approved here.\nallowBuilds:\n  esbuild: true\n',
);

writeFileSync(join(out, '.npmrc'), '@kete-africa:registry=https://npm.pkg.github.com\n');

writeFileSync(
  join(out, 'Dockerfile'),
  `# Kete Cockpit: Vite builds, srvx serves SSR and static files. The @kete/* packages come from
# GitHub Packages: the build receives NODE_AUTH_TOKEN as a secret, never as a layer.

FROM node:22.14.0-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=secret,id=node_auth_token,env=NODE_AUTH_TOKEN \\
  pnpm config set "//npm.pkg.github.com/:_authToken" "$NODE_AUTH_TOKEN" \\
  && pnpm install --frozen-lockfile \\
  && pnpm config delete "//npm.pkg.github.com/:_authToken"
COPY . .
RUN pnpm build

FROM node:22.14.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@11.25.0 && groupadd --system kete && useradd --system --gid kete --home-dir /app kete
COPY --from=build --chown=kete:kete /app ./
USER kete
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=6 \\
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["pnpm", "start"]
`,
);

mkdirSync(join(out, '.github', 'workflows'), { recursive: true });
writeFileSync(
  join(out, '.github', 'workflows', 'ci.yml'),
  `name: CI

on:
  pull_request:
  push:
    branches: [dev, main]

permissions:
  contents: read
  packages: read

jobs:
  check:
    runs-on: ubuntu-latest
    env:
      # A token that reads kete-core's packages (read:packages): the repository's own token cannot.
      NODE_AUTH_TOKEN: \${{ secrets.KETE_PACKAGES_TOKEN }}
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
        with:
          version: 11.25.0
      - uses: actions/setup-node@v5
        with:
          node-version: 22.14.0
          cache: pnpm
          # Writes NODE_AUTH_TOKEN into the runner's user configuration, never into the repository.
          registry-url: https://npm.pkg.github.com
          scope: '@kete-africa'
      - run: pnpm install --frozen-lockfile
      - name: Types (and the build)
        run: pnpm typecheck
      - name: Migrate the Kete Cockpit "test" branch
        run: pnpm db:migrate
        env:
          COCKPIT_OWNER_URL: \${{ secrets.COCKPIT_TEST_OWNER_URL }}
      - name: Tests (Neon "test" branch)
        run: pnpm test
        env:
          COCKPIT_TEST_APP_URL: \${{ secrets.COCKPIT_TEST_APP_URL }}
      - name: The image builds, starts and reports healthy
        run: docker build --secret id=node_auth_token,env=NODE_AUTH_TOKEN -t kete-cockpit:ci .
`,
);

writeFileSync(
  join(out, 'CLAUDE.md'),
  `# Kete Cockpit — project context

> The single place where this repository's context lives. \`AGENTS.md\` points here.

Kete Cockpit is where Kete operators run the Kete apps: the offers catalog, the app registry, their
events and health, the brief. It left kete-core for this repository (doctrine D-033, kete-core spec
030), with its history; it consumes kete-core's published packages (\`@kete-africa/*\`), never a
branch (D-034).

## Read before any action

1. The Kete doctrine (\`kete-africa/kete\`): \`docs/PRINCIPES.md\`, \`docs/CONCEPTION.md\`,
   \`docs/ARCHITECTURE_APP.md\`, \`docs/DECISIONS.md\` (D-019, D-022, D-033, D-034).
2. \`README.md\` — what the Cockpit does, how to run it and deploy it.

## Branches

\`main\` production (the human gesture only), \`dev\` integration (green CI), \`NNN-slug\` one feature.

## Forbidden to agents

- Pushing to \`main\` or \`dev\` directly; writing a secret in a file, a message or a commit.
- Creating a table without its RLS policy in the same migration; hard-coding a user-visible string.
- Shipping a behavior change without its documentation and diagram.
`,
);
writeFileSync(
  join(out, 'AGENTS.md'),
  '# AGENTS.md\n\nThe project context lives in [`CLAUDE.md`](CLAUDE.md). Read it first.\n',
);

git(out, 'add', '-A');
git(
  out,
  'commit',
  '--quiet',
  '-m',
  'chore: Kete Cockpit in its own repository (kete-core spec 030, doctrine D-033)',
);
console.log(
  `Kete Cockpit extracted with ${git(out, 'rev-list', '--count', 'HEAD')} commits: ${out}`,
);

// 3. Only when asked.
if (args.includes('--install')) {
  // The token travels in this command's environment only, never in a file.
  execFileSync('pnpm', ['install'], {
    cwd: out,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      'npm_config_//npm.pkg.github.com/:_authToken': process.env.NODE_AUTH_TOKEN,
    },
  });
  git(out, 'add', 'pnpm-lock.yaml');
  git(out, 'commit', '--quiet', '-m', 'chore: lockfile, from the published packages');
}
if (args.includes('--push')) {
  run(out, 'gh', [
    'repo',
    'create',
    'kete-africa/kete-cockpit',
    '--private',
    '--source',
    '.',
    '--push',
  ]);
}
