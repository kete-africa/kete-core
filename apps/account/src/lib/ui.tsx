import type { ReactNode, SelectHTMLAttributes } from 'react';
import { useEffect, useId, useState } from 'react';
import { KeteBand, KeteMark } from '@kete/design';
import * as m from '@/paraglide/messages.js';
import { getLocale, locales, setLocale } from '@/paraglide/runtime.js';

/** The word mark: the K, then "kete" in lowercase. */
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-primary">
      <KeteMark size={28} />
      <span className="font-display text-title font-extrabold lowercase text-ink">kete</span>
    </span>
  );
}

/** The frame of the signed-out screens: band, mark, one column. */
export function AuthFrame({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <KeteBand />
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Wordmark />
        <LanguageSwitch />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-12 pt-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-headline text-headline font-extrabold">{title}</h1>
          {intro && <p className="text-body-lg text-bark">{intro}</p>}
        </div>
        {children}
      </main>
      <footer className="px-4 py-6 text-body-sm text-bark sm:px-8">{m.brand_tagline()}</footer>
    </div>
  );
}

export function LanguageSwitch() {
  const current = getLocale();
  return (
    <div className="flex items-center gap-1" role="group" aria-label={m.language_label()}>
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === current}
          onClick={() => setLocale(locale)}
          className={
            locale === current
              ? 'rounded-control bg-ink px-2 py-1 text-body-sm font-semibold text-sand'
              : 'rounded-control px-2 py-1 text-body-sm font-semibold text-bark hover:bg-clay'
          }
        >
          {locale === 'fr' ? m.locale_fr() : m.locale_en()}
        </button>
      ))}
    </div>
  );
}

export function SelectField({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body-sm font-semibold">
        {label}
      </label>
      <select
        id={id}
        className="h-[46px] rounded-control border border-rule-strong bg-paper px-3 text-body text-ink disabled:opacity-60"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

/** A message after an action: a square marker, so it reads without color. */
export function Notice({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  const styles = {
    error: ['bg-error-surface text-error-ink', 'bg-error'],
    success: ['bg-success-surface text-success-ink', 'bg-success'],
    info: ['bg-info-surface text-info-ink', 'bg-info'],
  }[tone];
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2 px-4 py-3 text-body-sm ${styles[0]}`}
    >
      <span className={`mt-1.5 inline-block size-2 shrink-0 ${styles[1]}`} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function roleLabel(role: 'owner' | 'admin' | 'member'): string {
  return role === 'owner' ? m.role_owner() : role === 'admin' ? m.role_admin() : m.role_member();
}

/** Only same-site paths are followed after sign-in. */
export function safeRedirect(value: unknown): string | undefined {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : undefined;
}

/**
 * False until React runs in the browser. Forms stay disabled until then: submitted natively, they
 * would send their fields (a password) somewhere they must not go.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
