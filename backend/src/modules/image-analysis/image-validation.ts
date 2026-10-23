import sharp, { type Metadata } from 'sharp';
import { Errors } from '../../lib/errors.js';

export interface SanitizedImage {
  body: Buffer;
  contentType: 'image/jpeg';
  width: number;
  height: number;
  originalFormat: string;
}

const ALLOWED = new Set(['jpeg', 'png', 'webp']);

/**
 * Validate an upload by decoding its content (never trusting extension or
 * declared MIME type), then re-encode to JPEG. Re-encoding applies EXIF
 * orientation and drops all metadata — including GPS location, which would
 * otherwise reveal where the farmer lives.
 */
export async function sanitizeImage(input: Buffer, opts: { maxPixels: number; minDimension: number }): Promise<SanitizedImage> {
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: opts.maxPixels, failOn: 'error' }).metadata();
  } catch {
    throw Errors.unsupportedMediaType('The file is not a readable image. Please upload a JPEG, PNG or WebP photo.');
  }
  if (!meta.format || !ALLOWED.has(meta.format)) throw Errors.unsupportedMediaType('Only JPEG, PNG or WebP photos are accepted.');
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w * h > opts.maxPixels) throw Errors.payloadTooLarge('The photo resolution is too large.');
  if (Math.min(w, h) < opts.minDimension) throw Errors.unprocessable(`The photo is too small. Please use at least ${opts.minDimension} pixels on each side.`);
  try {
    const { data, info } = await sharp(input, { limitInputPixels: opts.maxPixels, failOn: 'error' })
      .rotate()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    return { body: data, contentType: 'image/jpeg', width: info.width, height: info.height, originalFormat: meta.format };
  } catch {
    throw Errors.unprocessable('The photo appears to be damaged. Please take it again.');
  }
}
