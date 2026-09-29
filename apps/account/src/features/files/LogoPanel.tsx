import { type FormEvent, useId, useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { Button, Panel } from '@kete/design';
import { Notice, useHydrated } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';
import { deleteLogo, finishLogoUpload, startLogoUpload } from './functions';

const accepted = ['image/png', 'image/jpeg', 'image/webp'] as const;
type Accepted = (typeof accepted)[number];
const maxBytes = 5 * 1024 * 1024;

type State =
  | { kind: 'idle' | 'pending' | 'saved' | 'removed' }
  | {
      kind: 'error';
      reason: 'too_large' | 'unsupported_type' | 'unreadable' | 'missing' | 'generic';
    };

const errorText = {
  too_large: m.file_error_too_large,
  unsupported_type: m.file_error_unsupported_type,
  unreadable: m.file_error_unreadable,
  missing: m.file_error_missing,
  generic: m.error_generic,
};

/**
 * The organization's logo: the browser sends the image straight to storage through a short-lived
 * address, then the server checks and re-encodes it before anyone can see it.
 */
export function LogoPanel({ logoUrl, canEdit }: { logoUrl: string | null; canEdit: boolean }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const inputId = useId();
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const file = new FormData(formElement).get('logo');
    if (!(file instanceof File) || file.size === 0) return;
    if (!accepted.includes(file.type as Accepted)) {
      setState({ kind: 'error', reason: 'unsupported_type' });
      return;
    }
    if (file.size > maxBytes) {
      setState({ kind: 'error', reason: 'too_large' });
      return;
    }
    setState({ kind: 'pending' });
    try {
      const { fileId, upload: target } = await startLogoUpload({
        data: { contentType: file.type as Accepted, size: file.size },
      });
      const sent = await fetch(target.url, {
        method: target.method,
        headers: target.headers,
        body: file,
      });
      if (!sent.ok) throw new Error(`upload ${sent.status}`);
      const outcome = await finishLogoUpload({ data: { fileId } });
      if (outcome.status === 'rejected') {
        setState({ kind: 'error', reason: outcome.reason });
        return;
      }
      formElement.reset();
      setState({ kind: 'saved' });
      await router.invalidate();
    } catch {
      setState({ kind: 'error', reason: 'generic' });
    }
  }

  async function remove() {
    setState({ kind: 'pending' });
    try {
      await deleteLogo();
      setState({ kind: 'removed' });
      await router.invalidate();
    } catch {
      setState({ kind: 'error', reason: 'generic' });
    }
  }

  return (
    <Panel title={m.settings_logo()}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-32 shrink-0 items-center justify-center border border-rule bg-sand">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={m.settings_logo_alt()}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <p className="p-3 text-center text-body-sm text-bark">{m.settings_logo_none()}</p>
          )}
        </div>
        {canEdit && (
          <form method="post" onSubmit={upload} className="flex min-w-0 flex-1 flex-col gap-3">
            <label htmlFor={inputId} className="text-body-sm font-semibold">
              {m.settings_logo_file()}
            </label>
            <input
              id={inputId}
              name="logo"
              type="file"
              accept={accepted.join(',')}
              required
              aria-describedby={`${inputId}-hint`}
              className="text-body-sm file:mr-3 file:h-10 file:cursor-pointer file:rounded-control file:border file:border-ink file:bg-paper file:px-4 file:font-semibold"
            />
            <p id={`${inputId}-hint`} className="text-body-sm text-bark">
              {m.settings_logo_hint()}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={state.kind === 'pending' || !hydrated}>
                {state.kind === 'pending' ? m.common_loading() : m.settings_logo_upload()}
              </Button>
              {logoUrl && (
                <Button
                  variant="secondary"
                  onClick={() => void remove()}
                  disabled={state.kind === 'pending' || !hydrated}
                >
                  {m.settings_logo_remove()}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
      <div className="mt-4 empty:hidden">
        {state.kind === 'saved' && <Notice tone="success">{m.settings_logo_saved()}</Notice>}
        {state.kind === 'removed' && <Notice tone="success">{m.settings_logo_removed()}</Notice>}
        {state.kind === 'error' && <Notice tone="error">{errorText[state.reason]()}</Notice>}
      </div>
    </Panel>
  );
}
