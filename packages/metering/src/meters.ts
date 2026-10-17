// What a product measures (spec 120): each meter declared once, by its owner, with its unit and
// its words — `ai.tokens`, `sandbox.minutes`, `deploy.count`, `storage.gb_days`.

export interface Words {
  fr: string;
  en: string;
}

export interface Meter {
  /** `<area>.<what>`: `ai.tokens`, `sandbox.minutes`. */
  name: string;
  /** The unit counted: `token`, `minute`, `gb_day`, `call`, `deploy`. */
  unit: string;
  label: Words;
}

export class MeterError extends Error {
  constructor(
    readonly code: 'invalid_meter' | 'unknown_meter' | 'invalid_measure',
    message: string,
  ) {
    super(message);
    this.name = 'MeterError';
  }
}

const NAME = /^[a-z][a-z0-9_]{0,30}\.[a-z][a-z0-9_]{0,40}$/;
const UNIT = /^[a-z][a-z0-9_]{0,20}$/;

export interface Meters {
  get(name: string): Meter | undefined;
  all(): readonly Meter[];
  /** The meter of a name, or `unknown_meter`. */
  require(name: string): Meter;
}

/** The meters a product knows; a name is declared once. */
export function defineMeters(...groups: readonly (readonly Meter[])[]): Meters {
  const byName = new Map<string, Meter>();
  for (const meter of groups.flat()) {
    if (!NAME.test(meter.name)) {
      throw new MeterError('invalid_meter', `« ${meter.name} » is not a meter's name.`);
    }
    if (!UNIT.test(meter.unit)) {
      throw new MeterError('invalid_meter', `« ${meter.name} »: no unit « ${meter.unit} ».`);
    }
    if (byName.has(meter.name)) throw new MeterError('invalid_meter', `« ${meter.name} » twice.`);
    byName.set(meter.name, meter);
  }
  const all = [...byName.values()];
  return {
    get: (name) => byName.get(name),
    all: () => all,
    require(name) {
      const meter = byName.get(name);
      if (!meter) throw new MeterError('unknown_meter', `No meter « ${name} ».`);
      return meter;
    },
  };
}

/** Kete's own meters, the same in every product. */
export const keteMeters: readonly Meter[] = [
  { name: 'ai.tokens', unit: 'token', label: { fr: 'Jetons d’IA', en: 'AI tokens' } },
  { name: 'ai.calls', unit: 'call', label: { fr: 'Appels à un modèle', en: 'Model calls' } },
  {
    name: 'sandbox.minutes',
    unit: 'minute',
    label: { fr: 'Minutes de bac à sable', en: 'Sandbox minutes' },
  },
  { name: 'deploy.count', unit: 'deploy', label: { fr: 'Déploiements', en: 'Deployments' } },
  {
    name: 'storage.gb_days',
    unit: 'gb_day',
    label: { fr: 'Stockage (Go × jours)', en: 'Storage (GB × days)' },
  },
  {
    name: 'messages.sent',
    unit: 'message',
    label: { fr: 'Messages envoyés (WhatsApp, SMS)', en: 'Messages sent (WhatsApp, SMS)' },
  },
];
