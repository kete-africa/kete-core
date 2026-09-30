import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';

// Spec 016, in Chromium with a virtual authenticator standing for Bitwarden: a person adds a
// passkey, drops her password, signs out, and signs back in with her passkey only.

const run = randomBytes(4).toString('hex');
const person = { name: 'Passkey Person', email: `passkey.${run}@example.test` };
const password = `e2e-${randomBytes(9).toString('base64url')}`;

test('a passkey replaces the password, and signs her in', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'The virtual authenticator is a Chromium protocol.');
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  await page.goto('/inscription');
  await page.getByLabel('Votre nom').fill(person.name);
  await page.getByLabel('Adresse e-mail').fill(person.email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await page.waitForURL('**/espace/nouvelle-organisation');
  await page.getByLabel("Nom de l'organisation").fill(`Passkeys ${run}`);
  await page.getByRole('button', { name: "Créer l'organisation" }).click();
  await page.waitForURL('**/espace');

  await page.goto('/espace/securite');
  await page.getByRole('button', { name: "Ajouter une clé d'accès" }).click();
  await expect(page.getByText("Clé d'accès ajoutée.")).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: /uniquement avec mes clés/ }).click();
  await expect(page.getByText(/n'a plus de mot de passe/)).toBeVisible();
  // Passkeys only: the two-factor panel, which needs a password, is gone.
  await expect(page.getByRole('heading', { name: 'Double authentification' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.waitForURL('**/connexion');
  await page.getByRole('button', { name: "Se connecter avec une clé d'accès" }).click();
  await page.waitForURL('**/espace');
  await expect(page.getByRole('heading', { name: 'Mes outils' })).toBeVisible();

  // Her password no longer opens anything.
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.waitForURL('**/connexion');
  await page.getByLabel('Adresse e-mail').fill(person.email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByText('Adresse e-mail ou mot de passe incorrect.')).toBeVisible();
});
