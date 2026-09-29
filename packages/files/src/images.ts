import { createHash } from 'node:crypto';
import sharp from 'sharp';

/**
 * Why a file is refused. Stable codes: apps translate them, they never show `message`.
 * - `too_large`: over the byte limit, or more pixels than allowed (a decompression bomb).
 * - `unsupported_type`: not a JPEG, PNG or WebP image once its content is read — whatever its
 *   name or declared type says (SVG, GIF, PDF, HTML… are refused here).
 * - `unreadable`: claims to be an image but cannot be decoded.
 */
export class UnsafeFileError extends Error {
  constructor(readonly code: 'too_large' | 'unsupported_type' | 'unreadable') {
    super(code);
    this.name = 'UnsafeFileError';
  }
}

export interface PrepareImageOptions {
  /** Defaults to 5 MB. */
  maxBytes?: number;
  /** Defaults to 40 million pixels. */
  maxPixels?: number;
  /** The longest side after re-encoding; smaller images are never enlarged. Defaults to 2048. */
  maxDimension?: number;
}

export interface PreparedImage {
  body: Uint8Array;
  contentType: 'image/webp';
  width: number;
  height: number;
  /** Hex SHA-256 of `body`, for the journal and deduplication. */
  sha256: string;
}

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);

/**
 * Makes an uploaded image safe to serve (decision 0001, point 3): the real format is read from the
 * content, the image is decoded and re-encoded as WebP — which drops anything hidden in the
 * original — and every metadata block (location, camera, comments) is removed. The orientation
 * recorded by the camera is applied first, so nothing looks rotated once metadata is gone.
 */
export async function prepareImage(
  input: Uint8Array,
  options: PrepareImageOptions = {},
): Promise<PreparedImage> {
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  const maxPixels = options.maxPixels ?? 40_000_000;
  const maxDimension = options.maxDimension ?? 2048;
  if (input.byteLength > maxBytes) throw new UnsafeFileError('too_large');

  let format: string | undefined;
  let pixels: number;
  try {
    const metadata = await sharp(input, { limitInputPixels: false }).metadata();
    format = metadata.format;
    pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
  } catch {
    throw new UnsafeFileError('unsupported_type');
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) throw new UnsafeFileError('unsupported_type');
  if (pixels === 0) throw new UnsafeFileError('unreadable');
  if (pixels > maxPixels) throw new UnsafeFileError('too_large');

  try {
    const { data, info } = await sharp(input, { limitInputPixels: maxPixels, failOn: 'error' })
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toBuffer({ resolveWithObject: true });
    const body = new Uint8Array(data);
    return {
      body,
      contentType: 'image/webp',
      width: info.width,
      height: info.height,
      sha256: createHash('sha256').update(body).digest('hex'),
    };
  } catch {
    throw new UnsafeFileError('unreadable');
  }
}
