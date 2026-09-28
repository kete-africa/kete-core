import { z } from 'zod';
import {
  canAdminister,
  ForbiddenError,
  inOrganization,
  requireMember,
  type Actor,
} from '@/platform/actor';
import { organizationSettings } from '@/platform/schema';

/** The generic settings every Kete app reads (doctrine D-013). */
export const settingsInput = z.object({
  companyName: z.string().trim().max(120).optional().default(''),
  address: z.string().trim().max(300).optional().default(''),
  phone: z.string().trim().max(40).optional().default(''),
  email: z
    .union([z.literal(''), z.email().max(120)])
    .optional()
    .default(''),
  rccm: z.string().trim().max(60).optional().default(''),
  nif: z.string().trim().max(60).optional().default(''),
  locale: z.enum(['fr', 'en']),
  timeZone: z.string().trim().min(1).max(60),
  currency: z.string().regex(/^[A-Z]{3}$/),
  notificationChannels: z
    .array(z.enum(['email', 'whatsapp', 'telegram']))
    .min(1)
    .max(3),
});

export type SettingsInput = z.input<typeof settingsInput>;

export interface OrganizationSettingsView {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  rccm: string;
  nif: string;
  locale: 'fr' | 'en';
  timeZone: string;
  currency: string;
  notificationChannels: ('email' | 'whatsapp' | 'telegram')[];
  canEdit: boolean;
}

const defaults = {
  companyName: '',
  address: '',
  phone: '',
  email: '',
  rccm: '',
  nif: '',
  locale: 'fr' as const,
  timeZone: 'Africa/Lome',
  currency: 'XOF',
  notificationChannels: ['email' as const],
};

/** Reads the active organization's settings; the database only returns that organization's row. */
export async function readSettings(actor: Actor | null): Promise<OrganizationSettingsView> {
  const me = requireMember(actor);
  const [row] = await inOrganization(me.organizationId, (tx) =>
    tx.select().from(organizationSettings),
  );
  const canEdit = canAdminister(me.role);
  if (!row) return { ...defaults, canEdit };
  return {
    companyName: row.companyName ?? '',
    address: row.address ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    rccm: row.legalIds.rccm ?? '',
    nif: row.legalIds.nif ?? '',
    locale: row.locale === 'en' ? 'en' : 'fr',
    timeZone: row.timeZone,
    currency: row.currency,
    notificationChannels:
      row.notificationChannels as OrganizationSettingsView['notificationChannels'],
    canEdit,
  };
}

/** Saves the settings; owners and administrators only. */
export async function saveSettings(actor: Actor | null, input: SettingsInput): Promise<void> {
  const me = requireMember(actor);
  if (!canAdminister(me.role)) throw new ForbiddenError('forbidden');
  const value = settingsInput.parse(input);
  const legalIds = Object.fromEntries(
    Object.entries({ rccm: value.rccm, nif: value.nif }).filter(([, v]) => v !== ''),
  );
  const row = {
    organizationId: me.organizationId,
    companyName: value.companyName || null,
    address: value.address || null,
    phone: value.phone || null,
    email: value.email || null,
    legalIds,
    locale: value.locale,
    timeZone: value.timeZone,
    currency: value.currency,
    notificationChannels: value.notificationChannels,
    updatedAt: new Date(),
    updatedBy: me.userId,
  };
  await inOrganization(me.organizationId, (tx) =>
    tx
      .insert(organizationSettings)
      .values(row)
      .onConflictDoUpdate({ target: organizationSettings.organizationId, set: row }),
  );
}
