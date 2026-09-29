import handler from '@tanstack/react-start/server-entry';
import { paraglideMiddleware } from './paraglide/server.js';
import { auth } from './platform/auth';
import { startRelay } from './platform/events';

// Better Auth finishes its setup (plugins, seeded OAuth resources) on first use. Waiting for it
// before serving anything keeps the first request after a start from failing.
const ready = auth.$context;

// Events leave for Kete Cockpit once it is configured (KETE_EVENTS_*).
startRelay();

export default {
  async fetch(request: Request): Promise<Response> {
    await ready;
    // Every request resolves its language first, so server-rendered text matches it.
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};
