import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DiskLinkError, diskStorage } from '../src/index.js';

// Spec 140, FR-009: a single server's files, on its disk.

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'kete-disk-'));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('a disk storage', () => {
  it('stores, describes, reads and deletes a file under its root', async () => {
    const disk = diskStorage(root);
    const key = 'threads/org_a/thr_1/fil_1';
    await disk.put(key, new TextEncoder().encode('vocal'), 'audio/ogg');
    expect(await disk.head(key)).toEqual({ size: 5, contentType: 'audio/ogg' });
    expect(new TextDecoder().decode((await disk.get(key)) ?? new Uint8Array())).toBe('vocal');
    await disk.delete(key);
    expect(await disk.get(key)).toBeNull();
    expect(await disk.head(key)).toBeNull();
  });

  it('never leaves its root, and signs no link', async () => {
    const disk = diskStorage(root);
    await expect(disk.put('../outside', new Uint8Array([1]), 'text/plain')).rejects.toThrow();
    await expect(disk.presignDownload('threads/a')).rejects.toBeInstanceOf(DiskLinkError);
  });
});
