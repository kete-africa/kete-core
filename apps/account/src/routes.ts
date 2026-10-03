import { index, rootRoute, route } from '@tanstack/virtual-file-routes';

// Every address of the Compte Kete, once: files are named in English, addresses read in French
// (doctrine ARCHITECTURE_APP §3). The addresses do not change: apps, e-mails and the OpenID
// provider (sign-in and consent pages) point to them.
export const routes = rootRoute('__root.tsx', [
  index('index.tsx'),
  route('/connexion', 'sign-in.tsx'),
  route('/connexion/code', 'sign-in-code.tsx'),
  route('/inscription', 'sign-up.tsx'),
  route('/consentement', 'consent.tsx'),
  route('/invitation/$id', 'invitation/$id.tsx'),
  route('/forgot-password', 'forgot-password.tsx'),
  route('/reset-password', 'reset-password.tsx'),
  // Mon espace Kete: one layout, its pages inside.
  route('/espace', 'space/layout.tsx', [
    index('space/index.tsx'),
    route('/abonnements', 'space/subscriptions.tsx'),
    route('/nouvelle-organisation', 'space/new-organization.tsx'),
    route('/organisation', 'space/organization.tsx'),
    route('/parametres', 'space/settings.tsx'),
    route('/securite', 'space/security.tsx'),
  ]),
  route('/api/auth/$', 'api/auth/$.ts'),
  route('/api/apps/access', 'api/apps/access.ts'),
  route('/api/apps/clients', 'api/apps/clients.ts'),
  route('/api/apps/continue', 'api/apps/continue.ts'),
  route('/api/apps/people', 'api/apps/people.ts'),
  route('/api/apps/sign-in-links', 'api/apps/sign-in-links.ts'),
  route('/api/admin/offers', 'api/admin/offers.ts'),
  route('/api/payments/notifications', 'api/payments/notifications.ts'),
  route('/health', 'api/health.ts'),
  route('/.well-known/kete', 'well-known/kete.ts'),
  route('/.well-known/openid-configuration', 'well-known/openid-configuration.ts'),
  route('/.well-known/oauth-authorization-server', 'well-known/oauth-authorization-server.ts'),
]);
