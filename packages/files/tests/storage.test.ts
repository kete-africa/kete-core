import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { assertValidKey, memoryStorage, s3Storage, type ObjectStorage } from '../src/index.js';

const env = process.env;
if (!env.ACCOUNT_TEST_STORAGE_ENDPOINT || !env.ACCOUNT_TEST_STORAGE_ACCESS_KEY_ID) {
  throw new Error('ACCOUNT_TEST_STORAGE_* must be set (see .env.example).');
}
const bucket = env.ACCOUNT_TEST_STORAGE_BUCKET ?? 'files';

const neon = s3Storage({
  endpoint: env.ACCOUNT_TEST_STORAGE_ENDPOINT,
  region: env.ACCOUNT_TEST_STORAGE_REGION ?? 'eu-central-1',
  bucket,
  accessKeyId: env.ACCOUNT_TEST_STORAGE_ACCESS_KEY_ID,
  secretAccessKey: env.ACCOUNT_TEST_STORAGE_SECRET_ACCESS_KEY ?? '',
});

const prefix = `tests/files-${randomBytes(4).toString('hex')}`;
const written: string[] = [];

afterAll(async () => {
  await Promise.all(written.map((key) => neon.delete(key)));
});

function contract(name: string, storage: ObjectStorage, network: boolean) {
  describe(name, () => {
    it('stores, describes, reads and deletes content', async () => {
      const key = `${prefix}/${name}/a.txt`;
      written.push(key);
      await storage.put(key, new TextEncoder().encode('hello'), 'text/plain');
      expect(await storage.head(key)).toMatchObject({ size: 5, contentType: 'text/plain' });
      expect(new TextDecoder().decode((await storage.get(key)) ?? new Uint8Array())).toBe('hello');
      await storage.delete(key);
      expect(await storage.head(key)).toBeNull();
      expect(await storage.get(key)).toBeNull();
    });

    it.runIf(network)('lets a browser send and read content through presigned URLs', async () => {
      const key = `${prefix}/${name}/b.txt`;
      written.push(key);
      const upload = await storage.presignUpload(key, {
        contentType: 'text/plain',
        expiresInSeconds: 60,
      });
      expect(upload.expiresAt.getTime()).toBeGreaterThan(Date.now());
      const put = await fetch(upload.url, {
        method: upload.method,
        headers: upload.headers,
        body: 'via url',
      });
      expect(put.status).toBe(200);
      const download = await storage.presignDownload(key, { expiresInSeconds: 60 });
      expect(await (await fetch(download)).text()).toBe('via url');
    });

    it('refuses keys that could escape their folder', async () => {
      for (const key of ['../x', 'a/../../x', '/abs', 'a b', '']) {
        expect(() => assertValidKey(key)).toThrow();
        await expect(storage.put(key, new Uint8Array(), 'text/plain')).rejects.toThrow();
      }
    });
  });
}

contract('memory', memoryStorage(), false);
contract('neon', neon, true);

describe('neon object storage access', () => {
  it('refuses a request without a valid signature', async () => {
    const response = await fetch(`${env.ACCOUNT_TEST_STORAGE_ENDPOINT}/${bucket}/${prefix}/x.txt`);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
