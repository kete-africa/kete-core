import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { prepareImage, UnsafeFileError } from '../src/index.js';

async function image(format: 'png' | 'jpeg' | 'webp' | 'gif', width = 64, height = 48) {
  const base = sharp({ create: { width, height, channels: 3, background: '#b83a1b' } });
  return new Uint8Array(await base.toFormat(format).toBuffer());
}

async function refusal(input: Uint8Array | Promise<Uint8Array>, options = {}) {
  const error = await prepareImage(await input, options).then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(UnsafeFileError);
  return (error as UnsafeFileError).code;
}

describe('prepareImage', () => {
  it.each(['png', 'jpeg', 'webp'] as const)('re-encodes a %s image as WebP', async (format) => {
    const prepared = await prepareImage(await image(format));
    expect(prepared.contentType).toBe('image/webp');
    expect((await sharp(prepared.body).metadata()).format).toBe('webp');
    expect([prepared.width, prepared.height]).toEqual([64, 48]);
    expect(prepared.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('removes location and every other metadata block', async () => {
    const withExif = new Uint8Array(
      await sharp({ create: { width: 32, height: 32, channels: 3, background: '#000' } })
        .jpeg()
        .withExif({ IFD0: { Copyright: 'secret owner', ImageDescription: 'home address' } })
        .toBuffer(),
    );
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const prepared = await prepareImage(withExif);
    const metadata = await sharp(prepared.body).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(Buffer.from(prepared.body).includes('secret owner')).toBe(false);
  });

  it('applies the camera orientation before dropping it', async () => {
    const rotated = new Uint8Array(
      await sharp({ create: { width: 40, height: 20, channels: 3, background: '#fff' } })
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer(),
    );
    const prepared = await prepareImage(rotated);
    expect([prepared.width, prepared.height]).toEqual([20, 40]);
  });

  it('shrinks large images, never enlarges small ones', async () => {
    const large = await prepareImage(await image('png', 3000, 1500), { maxDimension: 1000 });
    expect([large.width, large.height]).toEqual([1000, 500]);
    const small = await prepareImage(await image('png', 10, 10), { maxDimension: 1000 });
    expect([small.width, small.height]).toEqual([10, 10]);
  });

  it('refuses what is not a JPEG, PNG or WebP image, whatever it claims to be', async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    );
    expect(await refusal(svg)).toBe('unsupported_type');
    expect(await refusal(image('gif'))).toBe('unsupported_type');
    expect(await refusal(new TextEncoder().encode('%PDF-1.7 not an image'))).toBe(
      'unsupported_type',
    );
    expect(await refusal(new TextEncoder().encode('<html>hello</html>'))).toBe('unsupported_type');
  });

  it('refuses a truncated image', async () => {
    const png = await image('png', 200, 200);
    expect(await refusal(png.slice(0, Math.floor(png.byteLength / 2)))).toMatch(
      /unreadable|unsupported_type/,
    );
  });

  it('refuses files over the byte limit and images with too many pixels', async () => {
    expect(await refusal(image('png'), { maxBytes: 10 })).toBe('too_large');
    expect(await refusal(image('png', 2000, 2000), { maxPixels: 1_000_000 })).toBe('too_large');
  });
});
