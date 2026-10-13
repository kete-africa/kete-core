import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.gen.ts',
      '**/src/paraglide/**',
      '**/.tanstack/**',
      '**/.astro/**',
      'apps/docs/src/content/docs/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '.specify/**',
      '.claude/**',
      'specs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      // A package is used only through its public entry point, never through its internals.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@kete/*/src/*', '@kete/*/src'],
              message: 'Import a package through its public entry point.',
            },
            { group: ['**/examples/**'], message: 'Packages never depend on examples.' },
            {
              group: ['@mastra/*'],
              message: 'The agents’ runtime is used through @kete/agents only (decision 0010).',
            },
          ],
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // The one package that holds the agents' runtime (decision 0010).
    files: ['packages/agents/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@kete/*/src/*', '@kete/*/src'],
              message: 'Import a package through its public entry point.',
            },
            { group: ['**/examples/**'], message: 'Packages never depend on examples.' },
          ],
        },
      ],
    },
  },
);
