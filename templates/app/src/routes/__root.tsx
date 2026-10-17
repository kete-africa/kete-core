import { THEME_COOKIE } from '@kete/design';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getCookie, getRequest, setCookie } from '@tanstack/react-start/server';
import type { ReactNode } from 'react';
import * as m from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';
import { DESIGN } from '@/platform/app';
import { settingsOf } from '@/platform/settings';
import appCss from '@/styles/app.css?url';

/**
 * The mode and the language she chose (kete-core specs 041 and 115), read before the page is drawn:
 * no flash. Her preferences come from the Compte Kete and follow her in every app; the device's
 * cookie is their copy. A language she or her organization chose is kept for the next pages.
 */
const readTheme = createServerFn({ method: 'GET' }).handler(async () => {
  const settings = await settingsOf(getRequest()).catch(() => null);
  if (!settings) return null;
  const locale = settings.value<'fr' | 'en'>('kete.locale');
  if (settings.from('kete.locale') !== 'kete' && getCookie('kete_locale') !== locale) {
    setCookie('kete_locale', locale, { path: '/', maxAge: 31_536_000, sameSite: 'lax' });
  }
  if (settings.from('kete.theme') === 'kete') return null;
  const theme = settings.value<'dark' | 'light' | 'auto'>('kete.theme');
  if (settings.from('kete.theme') === 'person' && getCookie(THEME_COOKIE) !== theme) {
    setCookie(THEME_COOKIE, theme, { path: '/', maxAge: 31_536_000, sameSite: 'lax' });
  }
  return theme;
});

export const Route = createRootRoute({
  loader: () => readTheme(),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: m.app_name() },
      { name: 'description', content: m.meta_description() },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: Root,
});

function Root() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

function Document({ children }: Readonly<{ children: ReactNode }>) {
  const theme = Route.useLoaderData();
  return (
    <html lang={getLocale()} data-design={DESIGN} {...(theme ? { 'data-theme': theme } : {})}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
