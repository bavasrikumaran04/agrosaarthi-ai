import { hash, verify } from '@node-rs/argon2';

export interface PasswordHasherOptions {
  memoryCostKiB: number;
  timeCost: number;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
  /** Burn comparable time when the account does not exist (user-enumeration resistance). */
  verifyDummy(password: string): Promise<void>;
}

/** argon2id (the library default algorithm) with configurable cost parameters. */
export function createPasswordHasher(opts: PasswordHasherOptions): PasswordHasher {
  const params = { memoryCost: opts.memoryCostKiB, timeCost: opts.timeCost, parallelism: 1, outputLen: 32 };
  let dummyHash: Promise<string> | undefined;
  return {
    hash: (password) => hash(password, params),
    verify: async (passwordHash, password) => {
      try {
        return await verify(passwordHash, password);
      } catch {
        return false;
      }
    },
    verifyDummy: async (password) => {
      dummyHash ??= hash('agrosaarthi-dummy-password-for-timing', params);
      await verify(await dummyHash, password).catch(() => false);
    },
  };
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', '12345678', '123456789', '1234567890', 'qwerty123', 'iloveyou', 'admin123', 'welcome1', '11111111',
  '00000000', 'abcd1234', 'password123', 'agrosaarthi', 'farmer123',
]);

/** Length-based policy (NIST SP 800-63B style): min length, max 128, block very common passwords. */
export function passwordPolicyIssues(password: string, minLength: number): string[] {
  const issues: string[] = [];
  if (password.length < minLength) issues.push(`must be at least ${minLength} characters`);
  if (password.length > 128) issues.push('must be at most 128 characters');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) issues.push('is too common; choose a less predictable password');
  return issues;
}
