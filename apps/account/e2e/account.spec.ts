import { randomBytes } from 'node:crypto';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { createTokenVerifier } from '@kete/auth';

// Spec 003, user stories 1 to 4, in a browser, against the test branch. Every run uses fresh
// addresses, so runs never collide.

const run = randomBytes(4).toString('hex');
const password = `e2e-${randomBytes(9).toString('base64url')}`;
const owner = { name: 'Awa Owner', email: `owner.${run}@example.test` };
const invited = { name: 'Kofi Member', email: `member.${run}@example.test` };
const organizationName = `Pressing ${run}`;

test.describe.configure({ mode: 'serial' });

async function signUp(page: Page, person: { name: string; email: string }) {
  await page.getByLabel('Votre nom').fill(person.name);
  await page.getByLabel('Adresse e-mail').fill(person.email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
}

type Session = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['storageState']>>;
const sessions = new Map<string, Session>();

/**
 * A page signed in as `email`. Each person signs in once; later tests reuse the session, as a
 * browser would — sign-in is rate-limited, and a test suite must not look like an attack.
 */
async function signedIn(browser: Browser, email: string): Promise<Page> {
  const saved = sessions.get(email);
  if (saved) {
    const page = await (await browser.newContext({ storageState: saved })).newPage();
    await page.goto('/espace');
    return page;
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/espace');
  sessions.set(email, await context.storageState());
  return page;
}

let invitationLink = '';

test('a person signs up, creates their organization and sees their tools', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL('**/connexion');
  await page.getByRole('link', { name: 'Créer un compte' }).click();
  await signUp(page, owner);

  await page.waitForURL('**/espace/nouvelle-organisation');
  await page.getByLabel("Nom de l'organisation").fill(organizationName);
  await page.getByRole('button', { name: "Créer l'organisation" }).click();

  await page.waitForURL('**/espace');
  await expect(page.getByRole('heading', { name: 'Mes outils' })).toBeVisible();
  for (const tool of ['Firmo', 'Nettio', 'Nyatefe', 'Kete Cockpit']) {
    await expect(page.getByRole('heading', { name: tool })).toBeVisible();
  }
  await expect(page.getByRole('combobox')).toHaveValue(/^org_/);
});

test('an address that already has an account cannot sign up again, without saying why', async ({
  page,
}) => {
  await page.goto('/inscription');
  await signUp(page, { name: 'Someone', email: owner.email });
  await expect(page.getByRole('alert')).toHaveText(
    'Impossible de créer un compte avec ces informations.',
  );
});

test('the owner saves the settings once, for the organization', async ({ browser }) => {
  const page = await signedIn(browser, owner.email);
  await page.goto('/espace/parametres');
  await page.getByLabel('Raison sociale').fill(`${organizationName} SARL`);
  await page.getByLabel('RCCM').fill('TG-LOM-2026-B-0001');
  await page.getByLabel('Devise').selectOption('XOF');
  await page.getByLabel('WhatsApp').check();
  await page.getByRole('button', { name: 'Enregistrer les paramètres' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Paramètres enregistrés.' }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Raison sociale')).toHaveValue(`${organizationName} SARL`);
  await expect(page.getByLabel('WhatsApp')).toBeChecked();
});

test('the owner invites a member, who accepts once with the invited address', async ({
  browser,
}) => {
  const ownerPage = await signedIn(browser, owner.email);
  await ownerPage.goto('/espace/organisation');
  await ownerPage.getByLabel('Adresse e-mail').fill(invited.email);
  await ownerPage.getByRole('button', { name: "Créer l'invitation" }).click();
  invitationLink = (await ownerPage.getByTestId('invitation-link').textContent()) ?? '';
  expect(invitationLink).toMatch(/\/invitation\/inv_/);

  const page = await (await browser.newContext()).newPage();
  await page.goto(invitationLink);
  await expect(page.getByText(`Vous êtes invité à rejoindre ${organizationName}.`)).toBeVisible();
  await page.getByRole('link', { name: 'Créer un compte' }).click();
  await signUp(page, invited);
  await page.waitForURL('**/invitation/**');
  await page.getByRole('button', { name: "Accepter l'invitation" }).click();

  await page.waitForURL('**/espace');
  await page.goto('/espace/organisation');
  await expect(page.getByText(owner.email)).toBeVisible();
  await expect(
    page.getByText('Seuls les propriétaires et les administrateurs peuvent inviter.'),
  ).toBeVisible();

  // Used once: the link no longer opens.
  const again = await (await browser.newContext()).newPage();
  await again.goto(invitationLink);
  await expect(again.getByText("Cette invitation n'est plus valable.")).toBeVisible();
});

test('a member can neither invite nor change settings', async ({ browser }) => {
  const page = await signedIn(browser, invited.email);

  const invite = await page.request.post('/api/auth/organization/invite-member', {
    data: { email: `intruder.${run}@example.test`, role: 'admin' },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(invite.ok()).toBe(false);

  await page.goto('/espace/parametres');
  await expect(
    page.getByText(
      'Seuls les propriétaires et les administrateurs peuvent modifier ces paramètres.',
    ),
  ).toBeVisible();
  await expect(page.getByLabel('Raison sociale')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Enregistrer les paramètres' })).toHaveCount(0);
});

test('an app verifies the Compte Kete token: person, organization and role', async ({
  browser,
  baseURL,
}) => {
  const ownerPage = await signedIn(browser, owner.email);
  const response = await ownerPage.request.get('/api/auth/token');
  expect(response.ok()).toBe(true);
  const { token } = (await response.json()) as { token: string };

  const verify = createTokenVerifier({ issuer: String(baseURL) });
  const identity = await verify(token);
  expect(identity).toMatchObject({ email: owner.email, role: 'owner' });
  expect(identity.userId).toMatch(/^usr_/);
  expect(identity.organizationId).toMatch(/^org_/);

  const memberPage = await signedIn(browser, invited.email);
  const memberToken = (
    (await (await memberPage.request.get('/api/auth/token')).json()) as {
      token: string;
    }
  ).token;
  const member = await verify(memberToken);
  expect(member).toMatchObject({ email: invited.email, role: 'member' });
  expect(member.organizationId).toBe(identity.organizationId);
});

test('Mon espace Kete is usable at 375 px, in English too', async ({ browser }) => {
  const page = await signedIn(browser, owner.email);
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ['/espace', '/espace/organisation', '/espace/parametres']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Organization settings' })).toBeVisible();
});

test('repeated sign-in attempts are slowed down, and the person is told so', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(owner.email);
  await page.getByLabel('Mot de passe').fill('not-the-password');
  const alert = page.getByRole('alert');
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(alert).toBeVisible();
    if ((await alert.textContent())?.includes('Trop de tentatives')) break;
  }
  await expect(alert).toHaveText('Trop de tentatives. Réessayez dans une minute.');
});
