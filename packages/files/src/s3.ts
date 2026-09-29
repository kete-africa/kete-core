import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  assertValidKey,
  DEFAULT_DOWNLOAD_EXPIRY_SECONDS,
  DEFAULT_UPLOAD_EXPIRY_SECONDS,
  type ObjectStorage,
} from './storage.js';

export interface S3StorageOptions {
  /** e.g. the branch endpoint of Neon object storage. */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof NoSuchKey ||
    error instanceof NotFound ||
    (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
  );
}

/** Any S3-compatible storage with path-style addressing (Neon object storage first, decision 0002). */
export function s3Storage(options: S3StorageOptions): ObjectStorage {
  const client = new S3Client({
    endpoint: options.endpoint,
    region: options.region,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
  });
  const Bucket = options.bucket;

  return {
    async put(key, body, contentType) {
      assertValidKey(key);
      await client.send(
        new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }),
      );
    },
    async get(key) {
      assertValidKey(key);
      try {
        const object = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        return object.Body ? await object.Body.transformToByteArray() : new Uint8Array();
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    async head(key) {
      assertValidKey(key);
      try {
        const object = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return { size: object.ContentLength ?? 0, contentType: object.ContentType };
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    async delete(key) {
      assertValidKey(key);
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
    async presignUpload(key, { contentType, expiresInSeconds = DEFAULT_UPLOAD_EXPIRY_SECONDS }) {
      assertValidKey(key);
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }),
        { expiresIn: expiresInSeconds },
      );
      return {
        url,
        method: 'PUT',
        headers: { 'content-type': contentType },
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      };
    },
    async presignDownload(key, { expiresInSeconds = DEFAULT_DOWNLOAD_EXPIRY_SECONDS } = {}) {
      assertValidKey(key);
      return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key }), {
        expiresIn: expiresInSeconds,
      });
    },
  };
}
