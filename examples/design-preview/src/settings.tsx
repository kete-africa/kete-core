import {
  AppFrame,
  placesFor,
  SettingsPanel,
  type SettingRow,
  type SettingsWords,
} from '@kete/shell';
import { places, words } from './canvas';

// « Réglages » (kete-core spec 116), as Kete Finance shows it in the frame: Afi's preferences,
// then what the organization sets — each value with where it comes from. Words are literal.

const hour = { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' };
const hours = {
  type: 'object',
  properties: { from: hour, to: hour },
  required: ['from', 'to'],
  additionalProperties: false,
};

const rows: SettingRow[] = [
  {
    key: 'kete.theme',
    label: 'Thème',
    group: 'display',
    schema: { type: 'string', enum: ['dark', 'light', 'auto'] },
    choices: { auto: 'Comme l’appareil', light: 'Clair', dark: 'Sombre' },
    value: 'dark',
    from: 'person',
    editable: 'person',
    layers: ['person', 'device'],
  },
  {
    key: 'kete.text_size',
    label: 'Taille du texte',
    group: 'display',
    schema: { type: 'string', enum: ['normal', 'large'] },
    choices: { normal: 'Normale', large: 'Grande' },
    value: 'normal',
    from: 'kete',
    editable: 'person',
    layers: ['person', 'device'],
  },
  {
    key: 'kete.reduce_motion',
    label: 'Réduire les animations',
    group: 'display',
    schema: { type: 'boolean' },
    value: false,
    from: 'kete',
    editable: 'person',
    layers: ['person', 'device'],
  },
  {
    key: 'kete.locale',
    label: 'Langue',
    group: 'language',
    schema: { type: 'string', enum: ['fr', 'en'] },
    choices: { fr: 'Français', en: 'Anglais' },
    value: 'fr',
    from: 'organization',
    editable: 'person',
    layers: ['organization', 'person'],
  },
  {
    key: 'kete.quiet_hours',
    label: 'Heures calmes',
    description: 'Rien sur le téléphone pendant ces heures, sauf l’urgent.',
    group: 'notifications',
    schema: { anyOf: [hours, { type: 'null' }] },
    value: { from: '21:00', to: '07:00' },
    from: 'person',
    editable: 'person',
    layers: ['person'],
  },
  {
    key: 'kete.notification_channels',
    label: 'Canaux de notification',
    group: 'notifications',
    schema: { type: 'array', items: { type: 'string', enum: ['email', 'whatsapp', 'telegram'] } },
    choices: { email: 'E-mail', whatsapp: 'WhatsApp', telegram: 'Telegram' },
    value: ['email', 'whatsapp'],
    from: 'organization',
    editable: 'person',
    layers: ['organization', 'person'],
  },
  {
    key: 'kete.currency',
    label: 'Devise',
    group: 'language',
    schema: { type: 'string', pattern: '^[A-Z]{3}$' },
    value: 'XOF',
    from: 'organization',
    editable: 'app',
    layers: ['organization', 'entity', 'app'],
  },
  {
    key: 'prd_finance.payment_days',
    label: 'Délai de paiement des factures (jours)',
    group: 'invoices',
    schema: { type: 'integer', minimum: 0, maximum: 120 },
    value: 30,
    from: 'app',
    editable: 'app',
    layers: ['app', 'entity'],
  },
  {
    key: 'kete.company_name',
    label: 'Nom de l’entreprise',
    group: 'identity',
    schema: { type: 'string', maxLength: 120 },
    value: 'Soleil d’Afrique SARL',
    from: 'organization',
    layers: ['organization', 'entity'],
  },
  {
    key: 'kete.working_hours',
    label: 'Heures ouvrées',
    group: 'calendar',
    schema: hours,
    value: { from: '08:00', to: '18:00' },
    from: 'kete',
    layers: ['organization', 'entity'],
  },
];

const groups: Record<string, string> = {
  display: 'Affichage',
  language: 'Langue, heure et monnaie',
  notifications: 'Notifications',
  invoices: 'Factures',
  identity: 'Identité',
  calendar: 'Calendrier',
};

const layers = {
  kete: 'Valeur de Kete',
  organization: 'Réglé par l’organisation',
  app: 'Réglé pour cette app',
  entity: 'Réglé pour cette entité',
  person: 'Votre préférence',
  device: 'Cet appareil',
};

const settingsWords: SettingsWords = {
  mine: 'Pour moi',
  mineHint: 'Elles vous suivent dans toutes les apps Kete.',
  organization: 'Pour l’organisation',
  organizationHint:
    'Pour toute l’organisation, dans Kete Finance. Chaque changement est gardé au journal.',
  group: (group) => groups[group] ?? group,
  from: (layer) => layers[layer],
  inherit: 'Reprendre la valeur héritée',
  none: 'Aucune',
  yes: 'Oui',
  no: 'Non',
  part: (name) => (name === 'from' ? 'De' : name === 'to' ? 'À' : name),
  elsewhere: (row) =>
    row.layers?.includes('app') ? 'Un administrateur le règle' : 'Se règle dans le Compte Kete',
  saving: 'Enregistrement…',
  saved: 'Enregistré',
  failed: () => 'Pas enregistré, réessayez.',
};

const answer = () =>
  new Promise<{ ok: true }>((resolve) => setTimeout(() => resolve({ ok: true }), 400));

export function SettingsPage() {
  return (
    <AppFrame
      brand={{ name: 'Kete' }}
      org={{ name: 'Soleil d’Afrique' }}
      space={{
        name: 'Kete Finance',
        mark: 'F',
        color: 'var(--color-accent)',
        question: 'Combien ai-je vraiment, projet par projet ?',
        back: { href: '?frame=canvas-light', label: 'Retour au centre' },
      }}
      sections={placesFor(places, { lang: 'fr' })}
      foot={{
        places: [
          { id: 'catalogue', label: 'Catalogue de prix', href: '#catalogue', icon: 'layers' },
          { id: 'settings', label: 'Réglages', href: '?frame=settings-light', icon: 'gear' },
        ],
      }}
      current="settings"
      person={{ name: 'Afi Mensah', detail: 'Direction' }}
      words={words}
    >
      <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-headline font-semibold">Réglages</h1>
          <p className="text-body text-fg-muted">
            Chaque réglage dit d’où vient sa valeur : de Kete, de l’organisation, de cette app ou de
            vous.
          </p>
        </div>
        <SettingsPanel rows={rows} words={settingsWords} onSave={answer} onClear={answer} />
      </div>
    </AppFrame>
  );
}
