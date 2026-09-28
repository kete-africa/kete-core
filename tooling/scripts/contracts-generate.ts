/**
 * Generates TypeScript types and embedded schemas from /contracts.
 * `--check` regenerates in memory and fails if the committed files differ.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from 'json-schema-to-typescript';

const root = join(import.meta.dirname, '..', '..');
const contractsDir = join(root, 'contracts');
const outDir = join(root, 'packages', 'sdk', 'src', 'contracts');
const header = '// Generated from /contracts by `pnpm contracts:generate`. Do not edit.\n';

const files = readdirSync(contractsDir)
  .filter((f) => f.endsWith('.schema.json'))
  .sort();

let types = header + '/* eslint-disable */\n';
const schemas: Record<string, unknown> = {};

for (const file of files) {
  const schema = JSON.parse(readFileSync(join(contractsDir, file), 'utf8')) as Record<
    string,
    unknown
  >;
  schemas[file.replace('.schema.json', '')] = schema;
  types +=
    '\n' +
    (await compile(schema as never, String(schema.title), {
      bannerComment: '',
      cwd: contractsDir,
      unreachableDefinitions: true,
      // Referenced contracts are declared once, in their own file; event-data only has $defs.
      declareExternallyReferenced: file.startsWith('event-data'),
      style: { singleQuote: true, printWidth: 100, trailingComma: 'all' },
    }));
}

const schemasSource =
  header + `export const schemas = ${JSON.stringify(schemas, null, 2)} as const;\n`;

const outputs: [string, string][] = [
  [join(outDir, 'types.gen.ts'), types],
  [join(outDir, 'schemas.gen.ts'), schemasSource],
];

if (process.argv.includes('--check')) {
  const stale = outputs.filter(([path, content]) => {
    try {
      return readFileSync(path, 'utf8') !== content;
    } catch {
      return true;
    }
  });
  if (stale.length > 0) {
    console.error('Generated contract files are out of date. Run `pnpm contracts:generate`.');
    for (const [path] of stale) console.error(`  ${path}`);
    process.exit(1);
  }
  console.log('Generated contract files are up to date.');
} else {
  for (const [path, content] of outputs) writeFileSync(path, content);
  console.log(`Generated ${outputs.length} files from ${files.length} contracts.`);
}
