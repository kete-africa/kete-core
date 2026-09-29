/**
 * The storage port: where file content lives. Business code never names a provider; adapters
 * (`s3Storage`, `memoryStorage`) implement this contract.
 */
export interface ObjectStorage {
  /** Stores content server-side. */
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Reads content, or null when the key holds nothing. */
  get(key: string): Promise<Uint8Array | null>;
  /** Size and declared type, or null when the key holds nothing. */
  head(key: string): Promise<{ size: number; contentType: string | undefined } | null>;
  delete(key: string): Promise<void>;
  /** A time-limited URL a browser uses to send content straight to storage. */
  presignUpload(key: string, options: PresignUploadOptions): Promise<PresignedRequest>;
  /** A time-limited URL to read content; never hand out a permanent one. */
  presignDownload(key: string, options?: PresignDownloadOptions): Promise<string>;
}

export interface PresignUploadOptions {
  contentType: string;
  /** Defaults to 600 seconds. */
  expiresInSeconds?: number;
}

export interface PresignDownloadOptions {
  /** Defaults to 300 seconds. */
  expiresInSeconds?: number;
}

export interface PresignedRequest {
  url: string;
  method: 'PUT';
  /** Headers the browser must send with the request. */
  headers: Record<string, string>;
  expiresAt: Date;
}

export const DEFAULT_UPLOAD_EXPIRY_SECONDS = 600;
export const DEFAULT_DOWNLOAD_EXPIRY_SECONDS = 300;

/** Keys are ASCII paths without traversal, so they mean the same thing on every adapter. */
export function assertValidKey(key: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._\-/]{0,511}$/.test(key) || key.split('/').includes('..')) {
    throw new Error(`Invalid storage key: ${JSON.stringify(key)}`);
  }
}

/**
 * An in-memory adapter for tests. Its presigned URLs are `memory://` placeholders: they prove the
 * flow's shape, not a network transfer.
 */
export function memoryStorage(): ObjectStorage & {
  objects: Map<string, { body: Uint8Array; contentType: string }>;
} {
  const objects = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    objects,
    async put(key, body, contentType) {
      assertValidKey(key);
      objects.set(key, { body: new Uint8Array(body), contentType });
    },
    get(key) {
      return Promise.resolve(objects.get(key)?.body ?? null);
    },
    head(key) {
      const object = objects.get(key);
      return Promise.resolve(
        object ? { size: object.body.byteLength, contentType: object.contentType } : null,
      );
    },
    delete(key) {
      objects.delete(key);
      return Promise.resolve();
    },
    async presignUpload(key, options) {
      assertValidKey(key);
      const seconds = options.expiresInSeconds ?? DEFAULT_UPLOAD_EXPIRY_SECONDS;
      return {
        url: `memory://upload/${key}`,
        method: 'PUT',
        headers: { 'content-type': options.contentType },
        expiresAt: new Date(Date.now() + seconds * 1000),
      };
    },
    async presignDownload(key) {
      assertValidKey(key);
      return `memory://download/${key}`;
    },
  };
}
