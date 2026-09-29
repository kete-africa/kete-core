import { type FormEvent, useEffect, useState } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Button, Panel, Tag, TextField } from '@kete/design';
import type { BillingView, OfferView, ReconcileOutcome } from '@/features/payments/billing';
import { PHONE_COUNTRIES } from '@/features/payments/countries';
import { beginCheckout, fetchBilling, verifyCheckout } from '@/features/payments/functions';
import { toolCatalog } from '@/features/tools/catalog';
import { Notice, SelectField, useHydrated } from '@/lib/ui';
import * as m from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

export const Route = createFileRoute('/espace/abonnements')({
  validateSearch: (search: Record<string, unknown>): { paiement?: string } =>
    typeof search.paiement === 'string' ? { paiement: search.paiement } : {},
  loader: () => fetchBilling(),
  component: Billing,
});

const appNames = Object.fromEntries(toolCatalog({}).map((tool) => [tool.id, tool.name]));

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long' }).format(new Date(iso));
}

function formatPrice(price: OfferView['price']) {
  return new Intl.NumberFormat(getLocale(), { style: 'currency', currency: price.currency }).format(
    price.value,
  );
}

function Billing() {
  const billing = Route.useLoaderData();
  const { paiement } = Route.useSearch();
  const apps = [
    ...new Set([...billing.offers.map((o) => o.app), ...billing.subscriptions.map((s) => s.app)]),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-headline text-headline font-extrabold">{m.billing_title()}</h1>
        <p className="text-body-lg text-bark">{m.billing_intro()}</p>
      </div>
      {paiement && <PaymentReturn checkoutId={paiement} />}
      {!billing.canPay && <Notice tone="info">{m.billing_only_admins()}</Notice>}
      {apps.length === 0 && <Notice tone="info">{m.billing_no_offers()}</Notice>}
      {apps.map((app) => (
        <AppBilling key={app} app={app} billing={billing} />
      ))}
    </div>
  );
}

function AppBilling({ app, billing }: { app: OfferView['app']; billing: BillingView }) {
  const subscription = billing.subscriptions.find((s) => s.app === app);
  const offers = billing.offers.filter((o) => o.app === app);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel title={appNames[app] ?? app}>
      <div className="mb-4">
        {!subscription ? (
          <Tag tone="neutral">{m.billing_state_none()}</Tag>
        ) : subscription.state === 'active' ? (
          <Tag tone="validated">
            {m.billing_state_active({ date: formatDate(subscription.paidUntil) })}
          </Tag>
        ) : subscription.state === 'grace' ? (
          <Tag tone="verify">
            {m.billing_state_grace({ date: formatDate(subscription.graceUntil) })}
          </Tag>
        ) : (
          <Tag tone="error">
            {m.billing_state_expired({ date: formatDate(subscription.graceUntil) })}
          </Tag>
        )}
      </div>
      <ul className="divide-y divide-rule">
        {offers.map((offer) => (
          <li key={offer.id} className="flex flex-col gap-3 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{offer.name}</p>
                <p className="text-body-sm text-bark">
                  {m.billing_period({ days: String(offer.periodDays) })}
                </p>
              </div>
              <p className="font-number text-body-lg">{formatPrice(offer.price)}</p>
              {billing.canPay && open !== offer.id && (
                <Button onClick={() => setOpen(offer.id)}>{m.billing_pay()}</Button>
              )}
            </div>
            {open === offer.id && (
              <CheckoutForm
                offerId={offer.id}
                needsEmail={billing.needsEmail}
                onCancel={() => setOpen(null)}
              />
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const countryNames = () => new Intl.DisplayNames([getLocale()], { type: 'region' });

function CheckoutForm({
  offerId,
  needsEmail,
  onCancel,
}: {
  offerId: string;
  needsEmail: boolean;
  onCancel: () => void;
}) {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<'phone' | 'email' | 'provider' | 'refused' | null>(null);
  const names = countryNames();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phoneNumber = String(form.get('phone')).replace(/[\s.-]/g, '');
    if (!/^\d{6,15}$/.test(phoneNumber)) {
      setError('phone');
      return;
    }
    const receiptEmail = String(form.get('email') ?? '').trim();
    if (needsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiptEmail)) {
      setError('email');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await beginCheckout({
        data: {
          offerId,
          phoneNumber,
          countryCode: String(form.get('country')) as (typeof PHONE_COUNTRIES)[number],
          ...(needsEmail ? { receiptEmail } : {}),
        },
      });
      if (!result.ok) {
        if (result.reason === 'email_required') {
          setError('email');
          setPending(false);
          return;
        }
        setError(result.reason === 'provider_unavailable' ? 'provider' : 'refused');
        setPending(false);
        return;
      }
      window.location.assign(result.checkoutUrl);
    } catch {
      setError('provider');
      setPending(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={submit}
      className="flex flex-col gap-3 border border-rule p-4 sm:max-w-md"
    >
      <SelectField label={m.billing_country()} name="country" defaultValue="TG">
        {PHONE_COUNTRIES.map((code) => (
          <option key={code} value={code}>
            {names.of(code) ?? code}
          </option>
        ))}
      </SelectField>
      <TextField
        label={m.billing_phone()}
        hint={m.billing_phone_hint()}
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        required
        {...(error === 'phone' ? { error: m.billing_invalid_phone() } : {})}
      />
      {needsEmail && (
        <TextField
          label={m.billing_receipt_email()}
          hint={m.billing_receipt_email_hint()}
          name="email"
          type="email"
          autoComplete="email"
          required
          {...(error === 'email' ? { error: m.billing_invalid_email() } : {})}
        />
      )}
      {error === 'provider' && <Notice tone="error">{m.billing_provider_unavailable()}</Notice>}
      {error === 'refused' && <Notice tone="error">{m.billing_offer_refused()}</Notice>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending || !hydrated}>
          {pending ? m.common_loading() : m.billing_go_to_payment()}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {m.billing_cancel()}
        </Button>
      </div>
    </form>
  );
}

/** Back from the payment page: the sale is re-read from the provider, never assumed. */
function PaymentReturn({ checkoutId }: { checkoutId: string }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<ReconcileOutcome | 'checking' | 'error'>('checking');

  async function check() {
    setOutcome('checking');
    try {
      const result = await verifyCheckout({ data: { checkoutId } });
      setOutcome(result);
      if (result.status === 'paid') await router.invalidate();
    } catch {
      setOutcome('error');
    }
  }

  useEffect(() => {
    // Checked once on arrival; the person can ask again.
    void check();
  }, [checkoutId]);

  if (outcome === 'checking') return <Notice tone="info">{m.billing_checking()}</Notice>;
  if (outcome === 'error') return <Notice tone="error">{m.error_generic()}</Notice>;
  if (outcome.status === 'paid') {
    return (
      <Notice tone="success">{m.billing_paid({ date: formatDate(outcome.paidUntil) })}</Notice>
    );
  }
  if (outcome.status === 'rejected') return <Notice tone="info">{m.billing_rejected()}</Notice>;
  if (outcome.status === 'pending') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Notice tone="info">{m.billing_pending()}</Notice>
        <Button variant="secondary" onClick={() => void check()}>
          {m.billing_check_again()}
        </Button>
      </div>
    );
  }
  return <Notice tone="error">{m.billing_failed()}</Notice>;
}
