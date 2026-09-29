import { prepareImage, UnsafeFileError } from '@kete/files';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  canAdminister,
  ForbiddenError,
  inOrganization,
  requireMember,
  type Actor,
} from '@/platform/actor';
import { prefixedId } from '@/platform/ids';
import { files, organizationSettings } from '@/platform/schema';
import { getStorage } from '@/platform/storage';

/** What a browser may send for a logo; the content itself is checked after the upload. */
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const LOGO_MAX_DIMENSION = 1024;

export const logoUploadInput = z.object({
  contentType: z.enum(LOGO_TYPES),
  size: z.number().int().positive().max(LOGO_MAX_BYTES),
});

export type LogoOutcome =
  | { status: 'available' }
  | { status: 'rejected'; reason: 'too_large' | 'unsupported_type' | 'unreadable' | 'missing' };

export class FileStateError extends Error {
  constructor(readonly code: 'not_found' | 'not_pending') {
    super(code);
    this.name = 'FileStateError';
  }
}

function administrator(actor: Actor | null) {
  const me = requireMember(actor);
  if (!canAdminister(me.role)) throw new ForbiddenError('forbidden');
  return me;
}

function keys(organizationId: string, fileId: string) {
  return {
    upload: `organizations/${organizationId}/uploads/${fileId}`,
    content: `organizations/${organizationId}/files/${fileId}.webp`,
  };
}

/**
 * Step 1: records a pending file and hands the browser a short-lived URL to send the original
 * straight to storage. Nothing is served until step 2 has made it safe.
 */
export async function requestLogoUpload(
  actor: Actor | null,
  input: z.input<typeof logoUploadInput>,
) {
  const me = administrator(actor);
  const { contentType } = logoUploadInput.parse(input);
  const fileId = prefixedId('file');
  const key = keys(me.organizationId, fileId).upload;
  await inOrganization(me.organizationId, (tx) =>
    tx.insert(files).values({
      id: fileId,
      organizationId: me.organizationId,
      purpose: 'organization_logo',
      uploadKey: key,
      createdBy: me.userId,
    }),
  );
  const upload = await getStorage().presignUpload(key, { contentType });
  return { fileId, upload: { ...upload, expiresAt: upload.expiresAt.toISOString() } };
}

/**
 * Step 2: reads what the browser sent, keeps it only if it is a real image, re-encodes it without
 * metadata, and makes it the organization's logo. The original never becomes readable.
 */
export async function completeLogoUpload(
  actor: Actor | null,
  fileId: string,
): Promise<LogoOutcome> {
  const me = administrator(actor);
  const storage = getStorage();
  const [file] = await inOrganization(me.organizationId, (tx) =>
    tx
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.purpose, 'organization_logo'))),
  );
  if (!file) throw new FileStateError('not_found');
  if (file.status !== 'pending' || !file.uploadKey) throw new FileStateError('not_pending');
  const uploadKey = file.uploadKey;

  const reject = async (reason: Extract<LogoOutcome, { status: 'rejected' }>['reason']) => {
    await inOrganization(me.organizationId, (tx) =>
      tx
        .update(files)
        .set({
          status: 'rejected',
          rejectionReason: reason,
          uploadKey: null,
          decidedAt: new Date(),
        })
        .where(and(eq(files.id, fileId), eq(files.status, 'pending'))),
    );
    await storage.delete(uploadKey);
    return { status: 'rejected', reason } as const;
  };

  // The declared size is not trusted: the stored one is checked before anything is read.
  const head = await storage.head(uploadKey);
  if (!head) return reject('missing');
  if (head.size > LOGO_MAX_BYTES) return reject('too_large');
  const original = await storage.get(uploadKey);
  if (!original) return reject('missing');

  let prepared;
  try {
    prepared = await prepareImage(original, {
      maxBytes: LOGO_MAX_BYTES,
      maxDimension: LOGO_MAX_DIMENSION,
    });
  } catch (error) {
    if (error instanceof UnsafeFileError) return reject(error.code);
    throw error;
  }

  const contentKey = keys(me.organizationId, fileId).content;
  await storage.put(contentKey, prepared.body, prepared.contentType);
  await storage.delete(uploadKey);

  const previous = await inOrganization(me.organizationId, async (tx) => {
    const decided = await tx
      .update(files)
      .set({
        status: 'available',
        uploadKey: null,
        contentKey,
        contentType: prepared.contentType,
        sizeBytes: prepared.body.byteLength,
        sha256: prepared.sha256,
        width: prepared.width,
        height: prepared.height,
        decidedAt: new Date(),
      })
      .where(and(eq(files.id, fileId), eq(files.status, 'pending')))
      .returning({ id: files.id });
    // Completed twice at once: the first one wins, the second changes nothing.
    if (decided.length === 0) throw new FileStateError('not_pending');

    const [settings] = await tx
      .select({ logoFileId: organizationSettings.logoFileId })
      .from(organizationSettings);
    await tx
      .insert(organizationSettings)
      .values({ organizationId: me.organizationId, logoFileId: fileId, updatedBy: me.userId })
      .onConflictDoUpdate({
        target: organizationSettings.organizationId,
        set: { logoFileId: fileId, updatedAt: new Date(), updatedBy: me.userId },
      });
    return retire(tx, settings?.logoFileId ?? null);
  });
  if (previous) await storage.delete(previous);
  return { status: 'available' };
}

/** Removes the logo; its content is destroyed, a trace of the file remains (decision 0001). */
export async function removeLogo(actor: Actor | null): Promise<void> {
  const me = administrator(actor);
  const previous = await inOrganization(me.organizationId, async (tx) => {
    const [settings] = await tx
      .select({ logoFileId: organizationSettings.logoFileId })
      .from(organizationSettings);
    if (!settings?.logoFileId) return null;
    await tx
      .update(organizationSettings)
      .set({ logoFileId: null, updatedAt: new Date(), updatedBy: me.userId })
      .where(eq(organizationSettings.organizationId, me.organizationId));
    return retire(tx, settings.logoFileId);
  });
  if (previous) await getStorage().delete(previous);
}

type Transaction = Parameters<Parameters<typeof inOrganization>[1]>[0];

/** Marks a replaced file deleted and returns the content key to destroy after commit. */
async function retire(tx: Transaction, fileId: string | null): Promise<string | null> {
  if (!fileId) return null;
  const [retired] = await tx
    .select({ contentKey: files.contentKey })
    .from(files)
    .where(eq(files.id, fileId));
  await tx
    .update(files)
    .set({ status: 'deleted', contentKey: null, decidedAt: new Date() })
    .where(eq(files.id, fileId));
  return retired?.contentKey ?? null;
}
