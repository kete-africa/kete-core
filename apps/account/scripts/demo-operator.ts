/**
 * The local platform's test operator (`pnpm platform`): on this machine only, a Compte Kete
 * account and its two organizations — « Kete », whose owner is a Kete operator, and « KYA démo »,
 * where every app's demonstration is seeded. Its credentials are made once and kept in
 * `apps/account/.env.demo`, which git ignores; they are never printed. Twice is harmless. Prints
 * `{ userId, kete, kya }`.
 *
 *   tsx --env-file=.env scripts/demo-operator.ts
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { auth } from '@/platform/auth';

if (process.env.KETE_ENVIRONMENT === 'production') {
  throw new Error('The test operator is made on a development machine only.');
}

const file = new URL('../.env.demo', import.meta.url);
if (!existsSync(file)) {
  writeFileSync(
    file,
    '# The local test operator (development only, never online); made by scripts/demo-operator.ts.\n' +
      'DEMO_OPERATOR_NAME=Opérateur de test\n' +
      'DEMO_OPERATOR_EMAIL=operateur@kete.test\n' +
      `DEMO_OPERATOR_PASSWORD=${randomBytes(15).toString('base64url')}\n`,
  );
}
const values = Object.fromEntries(
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => /^([A-Z_]+)=(.*)$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => [m[1] ?? '', m[2] ?? '']),
);
const name = values.DEMO_OPERATOR_NAME ?? 'Opérateur de test';
const email = values.DEMO_OPERATOR_EMAIL ?? '';
const password = values.DEMO_OPERATOR_PASSWORD ?? '';

const api = auth.api as unknown as {
  signUpEmail(input: {
    body: { name: string; email: string; password: string };
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: { user: { id: string } } }>;
  signInEmail(input: {
    body: { email: string; password: string };
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: { user: { id: string } } }>;
  createOrganization(input: { body: { name: string; slug: string }; headers: Headers }): Promise<{
    id: string;
  }>;
  listOrganizations(input: { headers: Headers }): Promise<{ id: string; name: string }[]>;
};

const signed = await api
  .signUpEmail({ body: { name, email, password }, returnHeaders: true })
  .catch(() => api.signInEmail({ body: { email, password }, returnHeaders: true }));
const headers = new Headers({
  cookie: signed.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; '),
});
const existing = await api.listOrganizations({ headers });
const organization = async (orgName: string) =>
  existing.find((o) => o.name === orgName)?.id ??
  (
    await api.createOrganization({
      body: {
        name: orgName,
        slug: `${orgName.toLowerCase().replace(/[^a-z]+/g, '-')}-${randomBytes(3).toString('hex')}`,
      },
      headers,
    })
  ).id;

console.log(
  JSON.stringify({
    userId: signed.response.user.id,
    kete: await organization('Kete'),
    kya: await organization('KYA démo'),
  }),
);
process.exit(0);
