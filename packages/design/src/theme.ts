// The person's choice of mode (spec 044): dark, light, or the device's own. The page sets it on
// <html data-theme>; the choice lives in a cookie so the server renders the page in the right mode
// at once, with no flash. Each design keeps its default mode when nothing is chosen.

export type ThemeChoice = 'dark' | 'light' | 'auto';

export const themeChoices: readonly ThemeChoice[] = ['dark', 'light', 'auto'];

/** The cookie that remembers the choice, for a year, on this site only. */
export const THEME_COOKIE = 'kete_theme';

/** The choice a request's cookies carry, or null when the person never chose. */
export function themeFromCookies(cookieHeader: string | null | undefined): ThemeChoice | null {
  const match = new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=(dark|light|auto)(?:;|$)`).exec(
    cookieHeader ?? '',
  );
  return (match?.[1] as ThemeChoice | undefined) ?? null;
}

/** The `Set-Cookie`/`document.cookie` value that remembers a choice. */
export function themeCookie(choice: ThemeChoice): string {
  return `${THEME_COOKIE}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Applies a choice to the page now, and remembers it (in the browser only). */
export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.setAttribute('data-theme', choice);
  document.cookie = themeCookie(choice);
}
