import { InvalidStorageKeyError } from './errors.js';

/** Matches StoredFile.storageKey maxlength. */
export const MAX_STORAGE_KEY_LENGTH = 500;

/**
 * One path segment: ASCII letters, digits, "_", "." and "-", starting with a
 * letter, digit or "_". This excludes "." / ".." / hidden files, separators
 * ("\\"), drive letters and alternate data streams (":"), NUL bytes, percent
 * encodings and non-ASCII look-alikes.
 */
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;

/** Device names Windows refuses as file names regardless of extension. */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

/**
 * Keys are "/"-separated relative paths such as "crop_image/2026/10/<uuid>.jpg".
 * The same rule applies to every adapter so a key that works locally also works on S3.
 */
export function isValidStorageKey(key: unknown): key is string {
  if (typeof key !== 'string' || key.length === 0 || key.length > MAX_STORAGE_KEY_LENGTH) return false;
  return key.split('/').every((segment) => {
    if (!SEGMENT.test(segment) || segment.endsWith('.') || segment.includes('..')) return false;
    const stem = segment.split('.')[0] ?? segment;
    return !WINDOWS_RESERVED.test(stem);
  });
}

export function assertValidStorageKey(key: string): void {
  if (!isValidStorageKey(key)) throw new InvalidStorageKeyError();
}
