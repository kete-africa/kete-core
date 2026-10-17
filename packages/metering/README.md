# @kete/metering

Who consumed what, and how much — a model's tokens, a sandbox's minutes, a deployment, the
messages sent — each figure said **known**, **estimated** or **unavailable** (spec 120; doctrine
D-059; phase 11, step B1). Kete Enterprise reads its AI spend there, the Cockpit its instances',
Pono its sandboxes', branches' and deployments'.

```mermaid
flowchart LR
  A[@kete/ai · a model call] -->|measure · known| J[(kete_measures · append-only)]
  S[a sandbox, a provider] -->|measure · estimated| J
  X[a silent source] -->|unavailable · a gap, never a zero| J
  J --> C[consumption · by meter, by subject]
  C --> V[known · estimated · unavailable, at least]
```

```ts
import { consumption, defineMeters, keteMeters, measure, unavailable } from '@kete/metering';

const meters = defineMeters(keteMeters, [
  { name: 'pono.previews', unit: 'preview', label: { fr: 'Aperçus', en: 'Previews' } },
]);
await measure(tx, organizationId, meters, {
  meter: 'ai.tokens',
  quantity: 12_000,
  certainty: 'known',
  subject: { kind: 'agent', id: 'agt_assistant' },
  source: 'kete-ai',
  from: new Date(),
  key: callId, // a retried job is kept once
});
await unavailable(tx, organizationId, meters, {
  meter: 'sandbox.minutes',
  source: 'sandbox',
  from,
  to,
  reason,
});
await consumption(tx, { from, to, bySubject: true });
// [{ meter: 'ai.tokens', subject, quantity: 12000, certainty: 'known', gaps: 0 }, …]
```

## Guarantees

- **Never a guess passed off as a count**: a total is `known` only when every measure was
  counted; `estimated` when one was estimated; `unavailable` when a source could not tell — its
  quantity is then what is known, at least, and `gaps` says how many periods are missing.
- **Kept once** per `key`: a retried job does not count twice.
- **Never changed**: `kete_measures` is append-only for the application, with its RLS policy in
  the same migration.
