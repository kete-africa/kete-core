import { s3Storage, type ObjectStorage } from '@kete/files';
import { env } from './env';

let storage: ObjectStorage | undefined;

/** The object storage of this service, created on first use. */
export function getStorage(): ObjectStorage {
  storage ??= s3Storage(env.storage);
  return storage;
}

/** Tests swap the adapter (e.g. `memoryStorage()`). */
export function useStorage(next: ObjectStorage): void {
  storage = next;
}
