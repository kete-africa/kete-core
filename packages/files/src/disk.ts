import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { assertValidKey, type ObjectStorage } from './storage.js';

// Files on a disk (spec 140, FR-009): the storage of a single server, and of development, when no
// bucket is set. Each key is a path under the root, never outside it; its type is kept beside it.
// A disk signs no links: the product serves its files through its own routes, with the reader's
// rights.

export class DiskLinkError extends Error {
  constructor() {
    super('A disk signs no links: serve the file through the product’s own route.');
    this.name = 'DiskLinkError';
  }
}

/** A storage on a disk, under `root`. */
export function diskStorage(root: string): ObjectStorage {
  const base = resolve(root);
  const pathOf = (key: string) => {
    assertValidKey(key);
    const path = resolve(join(base, key));
    if (!path.startsWith(base + sep))
      throw new Error(`Invalid storage key: ${JSON.stringify(key)}`);
    return path;
  };
  const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
  return {
    async put(key, body, contentType) {
      const path = pathOf(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
      await writeFile(`${path}.type`, contentType);
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(pathOf(key)));
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
    },
    async head(key) {
      const path = pathOf(key);
      try {
        const found = await stat(path);
        const contentType = await readFile(`${path}.type`, 'utf8').catch(() => undefined);
        return { size: found.size, contentType };
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
    },
    async delete(key) {
      const path = pathOf(key);
      await rm(path, { force: true });
      await rm(`${path}.type`, { force: true });
    },
    presignUpload() {
      return Promise.reject(new DiskLinkError());
    },
    presignDownload() {
      return Promise.reject(new DiskLinkError());
    },
  };
}
