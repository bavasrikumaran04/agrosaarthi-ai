import { createFieldCipher, createLookupHasher, type FieldCipher } from './crypto.js';
import { maskPhone, normalizePhone, phoneLast4 } from './phone.js';

/**
 * Stored representation of a phone number: never in clear text.
 *  - hash:      keyed HMAC of the E.164 number, indexed for lookups
 *  - encrypted: AES-GCM ciphertext, decrypted only for authorised, audited reveals
 *  - last4:     for masked display ("******3210")
 */
export interface ProtectedPhone {
  hash: string;
  encrypted: string;
  last4: string;
}

export interface PersonalDataProtector {
  protectPhone(rawPhone: string): ProtectedPhone | null;
  phoneLookupHash(rawPhone: string): string | null;
  revealPhone(protectedPhone: Pick<ProtectedPhone, 'encrypted'>): string;
  maskedPhone(protectedPhone: Pick<ProtectedPhone, 'last4'>): string;
  cipher: FieldCipher;
}

export function createPersonalDataProtector(encryptionKeyBase64: string, hashKey: string): PersonalDataProtector {
  const cipher = createFieldCipher(encryptionKeyBase64);
  const hash = createLookupHasher(hashKey);
  return {
    cipher,
    protectPhone(rawPhone) {
      const e164 = normalizePhone(rawPhone);
      if (!e164) return null;
      return { hash: hash(e164), encrypted: cipher.encrypt(e164), last4: phoneLast4(e164) };
    },
    phoneLookupHash(rawPhone) {
      const e164 = normalizePhone(rawPhone);
      return e164 ? hash(e164) : null;
    },
    revealPhone(p) {
      return cipher.decrypt(p.encrypted);
    },
    maskedPhone(p) {
      return maskPhone(p.last4);
    },
  };
}
