/**
 * Phone-number helpers. Numbers are normalised to E.164 before hashing or
 * encryption so that "+91 98765 43210", "09876543210" and "9876543210" map to
 * the same farmer.
 */
const E164 = /^\+[1-9]\d{7,14}$/;

export function normalizePhone(input: string, defaultCountryCode = '91'): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 32) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length === 0) return null;

  let candidate: string;
  if (hasPlus) {
    candidate = `+${digits}`;
  } else if (digits.length === 10 && /^[6-9]/.test(digits)) {
    // Indian mobile number without prefix.
    candidate = `+${defaultCountryCode}${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    // Trunk-prefixed Indian number (0XXXXXXXXXX).
    candidate = `+${defaultCountryCode}${digits.slice(1)}`;
  } else if (digits.length === 12 && digits.startsWith(defaultCountryCode)) {
    candidate = `+${digits}`;
  } else if (digits.startsWith('00')) {
    candidate = `+${digits.slice(2)}`;
  } else {
    return null;
  }
  return E164.test(candidate) ? candidate : null;
}

export function phoneLast4(e164: string): string {
  return e164.slice(-4);
}

/** "+91 ******3210" — safe to display to staff who have not revealed the number. */
export function maskPhone(e164OrLast4: string): string {
  const last4 = e164OrLast4.slice(-4);
  return `******${last4}`;
}
