import handler from '@tanstack/react-start/server-entry';
import { paraglideMiddleware } from './paraglide/server.js';
import { auth } from './platform/auth';

// Better Auth finishes its setup (plugins, seeded OAuth resources) on first use. Waiting for it
// before serving anything keeps the first request after a start from failing.
const ready = auth.$context;

export default {
  async fetch(request: Request): Promise<Response> {
    await ready;
    // Every request resolves its language first, so server-rendered text matches it.
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};
