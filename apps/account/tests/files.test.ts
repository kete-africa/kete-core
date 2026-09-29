import { randomBytes } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  completeLogoUpload,
  FileStateError,
  removeLogo,
  requestLogoUpload,
} from '@/features/files/logo';
import { readSettings } from '@/features/settings/settings';
import { ForbiddenError, inOrganization, type Actor } from '@/platform/actor';
import { db, getPool } from '@/platform/db';
import { files, organization, organizationSettings, user } from '@/platform/schema';
import { getStorage } from '@/platform/storage';

// Spec 004: an organization's logo goes through storage safely, and no other organization can
// list, read or use it — in the database and in the service.

const run = randomBytes(4).toString('hex');
const orgA = `org_files_a_${run}`;
const orgB = `org_files_b_${run}`;
const person = `usr_files_${run}`;

function actor(organizationId: string, role: Actor['role']): Actor {
  return { userId: person, email: `${run}@example.test`, name: 'Test', organizationId, role };
}
const adminA = actor(orgA, 'owner');
const adminB = actor(orgB, 'admin');

async function png(width = 120, height = 60): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({ create: { width, height, channels: 3, background: '#b83a1b' } })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'hidden in the original' } })
      .toBuffer(),
  );
}

/** What the browser does: send the bytes to the presigned URL. */
async function send(url: string, headers: Record<string, string>, body: Uint8Array) {
  const response = await fetch(url, { method: 'PUT', headers, body: Buffer.from(body) });
  expect(response.status).toBe(200);
}

async function uploadLogo(who: Actor, body: Uint8Array, contentType = 'image/jpeg' as const) {
  const { fileId, upload } = await requestLogoUpload(who, { contentType, size: body.byteLength });
  await send(upload.url, upload.headers, body);
  return { fileId, outcome: await completeLogoUpload(who, fileId) };
}

async function fileRow(organizationId: string, fileId: string) {
  const [row] = await inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(files)
      .where(inArray(files.id, [fileId])),
  );
  return row;
}

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values({
    id: person,
    name: 'Test',
    email: `${run}@example.test`,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values([
    { id: orgA, name: 'A', slug: `files-a-${run}`, createdAt: now },
    { id: orgB, name: 'B', slug: `files-b-${run}`, createdAt: now },
  ]);
});

afterAll(async () => {
  for (const org of [orgA, orgB]) {
    const rows = await inOrganization(org, (tx) => tx.select().from(files));
    for (const row of rows) {
      for (const key of [row.uploadKey, row.contentKey]) if (key) await getStorage().delete(key);
    }
    await inOrganization(org, (tx) => tx.delete(organizationSettings));
  }
  await db.delete(organization).where(inArray(organization.id, [orgA, orgB]));
  await db.delete(user).where(inArray(user.id, [person]));
  await getPool().end();
});

let firstLogo = '';

describe('organization logo', () => {
  it('becomes available once re-encoded, without the original metadata', async () => {
    const { fileId, outcome } = await uploadLogo(adminA, await png());
    firstLogo = fileId;
    expect(outcome).toEqual({ status: 'available' });

    const row = await fileRow(orgA, fileId);
    expect(row).toMatchObject({ status: 'available', contentType: 'image/webp', uploadKey: null });
    expect(row?.sha256).toMatch(/^[0-9a-f]{64}$/);

    const { logoUrl } = await readSettings(adminA);
    expect(logoUrl).toBeTruthy();
    const served = new Uint8Array(await (await fetch(String(logoUrl))).arrayBuffer());
    const metadata = await sharp(served).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.exif).toBeUndefined();
    expect(Buffer.from(served).includes('hidden in the original')).toBe(false);
  });

  it('is invisible to another organization, in the database and in the service', async () => {
    expect((await readSettings(adminB)).logoUrl).toBeNull();
    expect(await inOrganization(orgB, (tx) => tx.select().from(files))).toEqual([]);
    await expect(completeLogoUpload(adminB, firstLogo)).rejects.toThrow(FileStateError);
    // Even a hand-written row cannot point another organization's settings at A's file.
    await expect(
      inOrganization(orgB, (tx) =>
        tx.insert(organizationSettings).values({ organizationId: orgB, logoFileId: firstLogo }),
      ),
    ).rejects.toThrow();
  });

  it('refuses content that is not an image, whatever the browser declared, and never serves it', async () => {
    const disguised = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    const { fileId, outcome } = await uploadLogo(adminA, disguised);
    expect(outcome).toEqual({ status: 'rejected', reason: 'unsupported_type' });
    const row = await fileRow(orgA, fileId);
    expect(row).toMatchObject({ status: 'rejected', uploadKey: null, contentKey: null });
    expect(await getStorage().head(`organizations/${orgA}/uploads/${fileId}`)).toBeNull();
    // The logo in place is untouched.
    expect((await fileRow(orgA, firstLogo))?.status).toBe('available');
  });

  it('is decided once: a second completion changes nothing', async () => {
    await expect(completeLogoUpload(adminA, firstLogo)).rejects.toThrow(FileStateError);
  });

  it('replaces the previous logo and destroys its content', async () => {
    const before = await fileRow(orgA, firstLogo);
    const { outcome } = await uploadLogo(adminA, await png(200, 200));
    expect(outcome.status).toBe('available');
    expect((await fileRow(orgA, firstLogo))?.status).toBe('deleted');
    expect(await getStorage().head(String(before?.contentKey))).toBeNull();
  });

  it('is removed on request', async () => {
    await removeLogo(adminA);
    expect((await readSettings(adminA)).logoUrl).toBeNull();
  });

  it('is managed by owners and administrators only', async () => {
    const member = actor(orgA, 'member');
    await expect(requestLogoUpload(member, { contentType: 'image/png', size: 10 })).rejects.toThrow(
      ForbiddenError,
    );
    await expect(removeLogo(member)).rejects.toThrow(ForbiddenError);
    await expect(
      requestLogoUpload(adminA, { contentType: 'image/svg+xml' as 'image/png', size: 10 }),
    ).rejects.toThrow();
    await expect(
      requestLogoUpload(adminA, { contentType: 'image/png', size: 50 * 1024 * 1024 }),
    ).rejects.toThrow();
  });
});
