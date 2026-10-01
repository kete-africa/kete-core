import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp, packageVersions, templateFolder } from '../src/index.js';

const read = (path: string) => readFileSync(path, 'utf8');

describe('a new Kete App', () => {
  const target = join(mkdtempSync(join(tmpdir(), 'kete-app-')), 'nettio');
  const versions = { ...packageVersions(), sdk: '1.2.3' };
  createApp({ name: 'nettio', design: 'workspace', target, template: templateFolder(), versions });

  it('takes its packages from the registry, never from a workspace', () => {
    const manifest = JSON.parse(read(join(target, 'package.json'))) as {
      name: string;
      dependencies: Record<string, string>;
    };
    expect(manifest.name).toBe('@kete/nettio');
    expect(manifest.dependencies['@kete/sdk']).toBe('npm:@kete-africa/sdk@^1.2.3');
    expect(read(join(target, 'package.json'))).not.toContain('workspace:');
    expect(read(join(target, '.npmrc'))).toContain(
      '@kete-africa:registry=https://npm.pkg.github.com',
    );
  });

  it('is named and designed as asked, its words in both languages', () => {
    expect(JSON.parse(read(join(target, 'kete.json')))).toMatchObject({
      product: 'prd_nettio',
      name: 'nettio',
    });
    expect(read(join(target, 'src', 'platform', 'app.ts'))).toContain(
      "export const DESIGN: string = 'workspace';",
    );
    for (const locale of ['fr', 'en']) {
      expect(JSON.parse(read(join(target, 'messages', `${locale}.json`))).app_name).toBe('nettio');
    }
    expect(read(join(target, 'tests', 'app.test.ts'))).toContain("product: 'prd_nettio'");
  });

  it('carries what makes it complete, and nothing a machine produced', () => {
    for (const file of [
      'CLAUDE.md',
      'AGENTS.md',
      'Dockerfile',
      '.gitignore',
      'pnpm-workspace.yaml',
      '.env.example',
      '.github/workflows/ci.yml',
      'docs/ARCHITECTURE.md',
      'src/routes.ts',
      'db/migrations.ts',
      'src/features/tasks/README.md',
    ]) {
      expect(existsSync(join(target, file)), file).toBe(true);
    }
    for (const produced of [
      'node_modules',
      'dist',
      'src/paraglide',
      'src/routeTree.gen.ts',
      '.env',
    ]) {
      expect(existsSync(join(target, produced)), produced).toBe(false);
    }
  });

  it('refuses a bad name, and an existing folder', () => {
    const template = templateFolder();
    expect(() =>
      createApp({
        name: 'Bad Name',
        design: 'kete',
        target: join(tmpdir(), 'x'),
        template,
        versions,
      }),
    ).toThrow();
    expect(() => createApp({ name: 'nettio', design: 'kete', target, template, versions })).toThrow(
      /exists/,
    );
  });
});
