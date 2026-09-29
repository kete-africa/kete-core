/**
 * Kete's catalog, for operators (until Kete Cockpit does it). The provider's product is the
 * reference for the name and the price; the offer says which app it opens and for how long.
 *
 *   pnpm offers list
 *   pnpm offers set --app nettio --product prd_xxx --days 30 [--grace 3] [--name "…"] [--dry-run]
 *   pnpm offers disable --product prd_xxx
 *
 * Needs ACCOUNT_OWNER_URL (owner role: the application role cannot write the catalog) and
 * PAYMENTS_CHARIOW_API_KEY.
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { chariowProvider } from '@kete/payments';
import pg from 'pg';

const APPS = ['firmo', 'nettio', 'nyatefe', 'cockpit'];

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    app: { type: 'string' },
    product: { type: 'string' },
    days: { type: 'string' },
    grace: { type: 'string' },
    name: { type: 'string' },
    'dry-run': { type: 'boolean' },
  },
});
const command = positionals[0];
const pool = new pg.Pool({ connectionString: required('ACCOUNT_OWNER_URL'), max: 1 });

try {
  if (command === 'list') {
    const { rows } = await pool.query(
      `select id, app, name, period_days, grace_days, provider_product_id, price_value, price_currency, active
         from offers order by app, period_days`,
    );
    console.table(rows);
  } else if (command === 'set') {
    const app = values.app ?? '';
    const days = Number(values.days);
    const grace = values.grace === undefined ? 3 : Number(values.grace);
    if (!APPS.includes(app)) throw new Error(`--app must be one of ${APPS.join(', ')}`);
    if (!values.product) throw new Error('--product is required');
    if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error('--days: 1 to 366');
    if (!Number.isInteger(grace) || grace < 0 || grace > 30) throw new Error('--grace: 0 to 30');
    const provider = chariowProvider({
      apiKey: required('PAYMENTS_CHARIOW_API_KEY'),
      pulseSecret: 'unused',
    });
    const product = await provider.getProduct(values.product);
    if (values['dry-run']) {
      console.log({ app, days, grace, product });
      process.exit(0);
    }
    const { rows } = await pool.query(
      `insert into offers (id, app, name, period_days, grace_days, provider, provider_product_id,
                           price_value, price_currency, active, updated_at)
       values ($1, $2, $3, $4, $5, 'chariow', $6, $7, $8, true, now())
       on conflict (provider, provider_product_id) do update
         set app = excluded.app, name = excluded.name, period_days = excluded.period_days,
             grace_days = excluded.grace_days, price_value = excluded.price_value,
             price_currency = excluded.price_currency, active = true, updated_at = now()
       returning id, app, name, period_days, price_value, price_currency`,
      [
        `ofr_${randomBytes(12).toString('base64url')}`,
        app,
        values.name ?? product.name,
        days,
        grace,
        product.id,
        product.price.value,
        product.price.currency,
      ],
    );
    console.table(rows);
  } else if (command === 'disable') {
    if (!values.product) throw new Error('--product is required');
    const { rowCount } = await pool.query(
      `update offers set active = false, updated_at = now() where provider_product_id = $1`,
      [values.product],
    );
    console.log(`${rowCount ?? 0} offer(s) disabled.`);
  } else {
    throw new Error(
      'Usage: offers list | set --app --product --days [--grace] [--name] | disable --product',
    );
  }
} finally {
  await pool.end();
}
