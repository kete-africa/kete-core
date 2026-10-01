// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { existsSync, readdirSync } from 'node:fs';
import { URL } from 'node:url';
import mermaid from 'astro-mermaid';
import starlightLinksValidator from 'starlight-links-validator';
import { createStarlightTypeDocPlugin } from 'starlight-typedoc';

// The API reference of each published package, generated from its public entry point.
const packages = readdirSync(new URL('../../packages/', import.meta.url)).filter((name) =>
  existsSync(new URL(`../../packages/${name}/src/index.ts`, import.meta.url)),
);
const apis = packages.map((name) => {
  const [plugin, sidebar] = createStarlightTypeDocPlugin();
  return {
    sidebar,
    plugin: plugin({
      entryPoints: [`../../packages/${name}/src/index.ts`],
      tsconfig: `../../packages/${name}/tsconfig.json`,
      output: `reference/api/${name}`,
      sidebar: { label: `@kete/${name}`, collapsed: true },
      typeDoc: { excludePrivate: true, excludeInternal: true, readme: 'none' },
    }),
  };
});

export default defineConfig({
  site: 'https://docs.kete.africa',
  integrations: [
    mermaid({ autoTheme: true }),
    starlight({
      title: 'Kete Core',
      description: 'The shared foundation of every Kete app.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/kete-africa/kete-core' },
      ],
      plugins: [...apis.map((api) => api.plugin), starlightLinksValidator()],
      sidebar: [
        { label: 'How-to guides', items: [{ autogenerate: { directory: 'how-to' } }] },
        {
          label: 'Reference',
          items: [
            { label: 'Packages', items: [{ autogenerate: { directory: 'reference/packages' } }] },
            { label: 'Contracts', items: [{ autogenerate: { directory: 'reference/contracts' } }] },
            { slug: 'reference/events' },
            { label: 'Apps', items: [{ autogenerate: { directory: 'reference/apps' } }] },
            { label: 'API', items: apis.map((api) => api.sidebar) },
          ],
        },
        {
          label: 'Explanation',
          items: [
            { slug: 'explanation/architecture' },
            { slug: 'explanation/roadmap' },
            { label: 'Flows', items: [{ autogenerate: { directory: 'explanation/flows' } }] },
            {
              label: 'Decisions',
              items: [{ autogenerate: { directory: 'explanation/decisions' } }],
            },
          ],
        },
      ],
    }),
  ],
});
