import { z } from 'zod';
import { setting } from './declare.js';

// Kete's own settings (spec 115, FR-002): what every product reads. The organization's identity,
// language, time zone, currency, channels and calendar; the person's language, theme, time zone,
// quiet hours, reduced motion, text size and home page.

const hour = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const text = (max: number) => z.string().trim().max(max);

export const keteSettings = [
  // The organization's identity: what its documents and messages carry.
  setting({
    key: 'kete.company_name',
    schema: text(120),
    default: '',
    layers: ['organization', 'entity'],
    permission: 'organization:settings',
    sensitivity: 'public',
    group: 'identity',
    label: { fr: 'Nom de l’entreprise', en: 'Company name' },
  }),
  setting({
    key: 'kete.address',
    schema: text(300),
    default: '',
    layers: ['organization', 'entity'],
    permission: 'organization:settings',
    sensitivity: 'public',
    group: 'identity',
    label: { fr: 'Adresse', en: 'Address' },
  }),
  setting({
    key: 'kete.phone',
    schema: text(40),
    default: '',
    layers: ['organization', 'entity'],
    permission: 'organization:settings',
    sensitivity: 'public',
    group: 'identity',
    label: { fr: 'Téléphone', en: 'Phone' },
  }),
  setting({
    key: 'kete.email',
    schema: z.union([z.literal(''), z.email().max(120)]),
    default: '',
    layers: ['organization', 'entity'],
    permission: 'organization:settings',
    sensitivity: 'public',
    group: 'identity',
    label: { fr: 'E-mail', en: 'E-mail' },
  }),
  setting({
    key: 'kete.legal_ids',
    schema: z.record(z.string().regex(/^[a-z][a-z0-9_]{1,30}$/), text(60)),
    default: {},
    layers: ['organization', 'entity'],
    permission: 'organization:settings',
    sensitivity: 'public',
    group: 'identity',
    label: { fr: 'Identifiants légaux (NIF, RCCM…)', en: 'Legal identifiers (tax id, register…)' },
  }),
  // Language, time and money.
  setting({
    key: 'kete.locale',
    schema: z.enum(['fr', 'en']),
    default: 'fr',
    layers: ['organization', 'person'],
    permission: 'organization:settings',
    sensitivity: 'public',
    group: 'language',
    label: { fr: 'Langue', en: 'Language' },
    choices: { fr: { fr: 'Français', en: 'French' }, en: { fr: 'Anglais', en: 'English' } },
  }),
  setting({
    key: 'kete.time_zone',
    schema: text(60).min(1),
    default: 'Africa/Lome',
    layers: ['organization', 'entity', 'person'],
    permission: 'organization:settings',
    sensitivity: 'public',
    group: 'language',
    label: { fr: 'Fuseau horaire', en: 'Time zone' },
  }),
  setting({
    key: 'kete.currency',
    schema: z.string().regex(/^[A-Z]{3}$/),
    default: 'XOF',
    layers: ['organization', 'entity', 'app'],
    permission: 'organization:settings',
    sensitivity: 'public',
    group: 'language',
    label: { fr: 'Devise', en: 'Currency' },
  }),
  // Notifications.
  setting({
    key: 'kete.notification_channels',
    schema: z
      .array(z.enum(['email', 'whatsapp', 'telegram']))
      .min(1)
      .max(3),
    default: ['email'],
    layers: ['organization', 'person'],
    permission: 'organization:settings',
    group: 'notifications',
    label: { fr: 'Canaux de notification', en: 'Notification channels' },
    choices: {
      email: { fr: 'E-mail', en: 'E-mail' },
      whatsapp: { fr: 'WhatsApp', en: 'WhatsApp' },
      telegram: { fr: 'Telegram', en: 'Telegram' },
    },
  }),
  setting({
    key: 'kete.quiet_hours',
    schema: z.object({ from: hour, to: hour }).nullable(),
    default: null,
    layers: ['person'],
    group: 'notifications',
    label: { fr: 'Heures calmes', en: 'Quiet hours' },
    description: {
      fr: 'Rien sur le téléphone pendant ces heures, sauf l’urgent.',
      en: 'Nothing on the phone in these hours, except what is urgent.',
    },
  }),
  // The calendar of the organization: working days (1 Monday … 7 Sunday), hours, holidays.
  setting({
    key: 'kete.working_days',
    schema: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    default: [1, 2, 3, 4, 5],
    layers: ['organization', 'entity'],
    permission: 'organization:settings',
    sensitivity: 'public',
    group: 'calendar',
    label: { fr: 'Jours ouvrés', en: 'Working days' },
    choices: {
      1: { fr: 'Lundi', en: 'Monday' },
      2: { fr: 'Mardi', en: 'Tuesday' },
      3: { fr: 'Mercredi', en: 'Wednesday' },
      4: { fr: 'Jeudi', en: 'Thursday' },
      5: { fr: 'Vendredi', en: 'Friday' },
      6: { fr: 'Samedi', en: 'Saturday' },
      7: { fr: 'Dimanche', en: 'Sunday' },
    },
  }),
  setting({
    key: 'kete.working_hours',
    schema: z.object({ from: hour, to: hour }),
    default: { from: '08:00', to: '18:00' },
    layers: ['organization', 'entity'],
    permission: 'organization:settings',
    sensitivity: 'public',
    group: 'calendar',
    label: { fr: 'Heures ouvrées', en: 'Working hours' },
  }),
  setting({
    key: 'kete.holidays',
    schema: z.array(z.object({ day: z.iso.date(), label: text(80).min(1) })).max(60),
    default: [],
    layers: ['organization', 'entity'],
    permission: 'organization:settings',
    sensitivity: 'public',
    group: 'calendar',
    label: { fr: 'Jours fériés', en: 'Holidays' },
  }),
  // What the organization's agents may do beyond Kete (spec 129): off until it says so.
  setting({
    key: 'kete.agent_abilities',
    schema: z.array(z.enum(['web', 'computer'])).max(2),
    default: [],
    layers: ['app', 'entity'],
    permission: 'organization:settings',
    sensitivity: 'public',
    group: 'agents',
    label: { fr: 'Ce que les agents font au-delà de Kete', en: 'What agents do beyond Kete' },
    description: {
      fr: 'Le web : chercher et lire des pages publiques — la question sort de l’organisation. Un ordinateur : un poste isolé, sans vos données ni vos secrets.',
      en: 'The web: search and read public pages — the question leaves the organization. A computer: an isolated machine, without your data or secrets.',
    },
    choices: {
      web: { fr: 'Chercher et lire sur le web', en: 'Search and read the web' },
      computer: { fr: 'Travailler sur un ordinateur à eux', en: 'Work on a computer of their own' },
    },
  }),
  // The person's own.
  setting({
    key: 'kete.spoken_answers',
    schema: z.boolean(),
    default: false,
    layers: ['person', 'device'],
    sensitivity: 'public',
    group: 'agents',
    label: { fr: 'Lire les réponses à voix haute', en: 'Read answers aloud' },
  }),
  setting({
    key: 'kete.theme',
    schema: z.enum(['dark', 'light', 'auto']),
    default: 'auto',
    layers: ['person', 'device'],
    sensitivity: 'public',
    group: 'display',
    label: { fr: 'Thème', en: 'Theme' },
    choices: {
      auto: { fr: 'Comme l’appareil', en: 'Like the device' },
      light: { fr: 'Clair', en: 'Light' },
      dark: { fr: 'Sombre', en: 'Dark' },
    },
  }),
  setting({
    key: 'kete.reduce_motion',
    schema: z.boolean(),
    default: false,
    layers: ['person', 'device'],
    sensitivity: 'public',
    group: 'display',
    label: { fr: 'Réduire les animations', en: 'Reduce motion' },
  }),
  setting({
    key: 'kete.text_size',
    schema: z.enum(['normal', 'large']),
    default: 'normal',
    layers: ['person', 'device'],
    sensitivity: 'public',
    group: 'display',
    label: { fr: 'Taille du texte', en: 'Text size' },
    choices: { normal: { fr: 'Normale', en: 'Normal' }, large: { fr: 'Grande', en: 'Large' } },
  }),
  setting({
    key: 'kete.home_page',
    schema: z
      .string()
      .regex(/^\/[^\s]{0,200}$/)
      .nullable(),
    default: null,
    layers: ['person'],
    group: 'display',
    label: { fr: 'Page d’accueil', en: 'Home page' },
  }),
];
