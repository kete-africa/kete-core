import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * A sign-in link is never e-mailed (spec 013): Better Auth builds the magic link and hands it to
 * `deliverSignInLink`, which gives it back to the request that asked for it — the app's, through
 * `captureSignInLink`. Outside such a request, no link is ever delivered anywhere.
 */
export const SIGN_IN_LINK_SECONDS = 10 * 60;

const slot = new AsyncLocalStorage<{ url?: string }>();

export async function captureSignInLink(request: () => Promise<unknown>): Promise<string> {
  const holder: { url?: string } = {};
  await slot.run(holder, request);
  if (!holder.url) throw new Error('No sign-in link was produced.');
  return holder.url;
}

export function deliverSignInLink(url: string): void {
  const holder = slot.getStore();
  if (!holder) throw new Error('Sign-in links are only handed to the app that asked for them.');
  holder.url = url;
}
