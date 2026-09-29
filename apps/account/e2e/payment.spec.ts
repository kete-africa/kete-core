import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';

// Against a deployed Compte Kete with a real provider, on explicit request only
// (ACCOUNT_E2E_PAYMENT=1): an owner reaches the provider's payment page, and coming back without
// paying grants nothing. It opens a real, unpaid sale in the provider's store — never in CI.

test.skip(
  process.env.ACCOUNT_E2E_PAYMENT !== '1' || !process.env.ACCOUNT_E2E_BASE_URL,
  'needs ACCOUNT_E2E_PAYMENT=1 and a deployed ACCOUNT_E2E_BASE_URL',
);

test('an owner reaches the payment page; coming back unpaid grants nothing', async ({ page }) => {
  const run = randomBytes(4).toString('hex');
  await page.goto('/inscription');
  await page.getByLabel('Votre nom').fill('Payment Check');
  await page.getByLabel('Adresse e-mail').fill(`payment.${run}@example.test`);
  await page.getByLabel('Mot de passe').fill(`e2e-${randomBytes(9).toString('base64url')}`);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await page.waitForURL('**/espace/nouvelle-organisation');
  await page.getByLabel("Nom de l'organisation").fill(`Paiement ${run}`);
  await page.getByRole('button', { name: "Créer l'organisation" }).click();
  await page.waitForURL('**/espace');

  await page.goto('/espace/abonnements');
  await page.getByRole('button', { name: 'Payer' }).first().click();
  await page.getByLabel('Téléphone du paiement').fill('90000000');
  await page.getByRole('button', { name: 'Aller au paiement' }).click();

  // The browser leaves for the provider's page.
  await page.waitForURL(
    (url) => url.origin !== new URL(String(process.env.ACCOUNT_E2E_BASE_URL)).origin,
    {
      timeout: 30_000,
    },
  );
  const providerPage = page.url();
  expect(providerPage).toMatch(/^https:\/\//);

  // Back without paying: nothing is granted.
  await page.goto('/espace/abonnements');
  await expect(page.getByText('Aucun abonnement').first()).toBeVisible();
  console.log(`provider page reached: ${new URL(providerPage).origin}`);
});
