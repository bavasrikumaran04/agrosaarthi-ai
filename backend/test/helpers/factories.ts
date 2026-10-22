import { UserModel, type UserDocument } from '../../src/db/models/user.model.js';
import type { CoreContainer } from '../../src/container.js';
import type { Role } from '../../src/shared/constants.js';

let counter = 0;

export interface CreatedUser {
  user: UserDocument;
  id: string;
  password: string;
  /** Ready-to-use "Bearer <token>" header value. */
  authorization: string;
  phone?: string;
  email?: string;
}

export interface CreateUserOptions {
  role: Role;
  name?: string;
  password?: string;
  phone?: string;
  email?: string;
  status?: 'ACTIVE' | 'DISABLED';
  extraPermissions?: string[];
  preferredLanguage?: string;
  expertProfile?: { specializations?: string[]; languages?: string[]; maxActiveCases?: number };
}

/** Insert a user directly (bypassing registration) and mint an access token for it. */
export async function createUser(core: CoreContainer, opts: CreateUserOptions): Promise<CreatedUser> {
  counter += 1;
  const password = opts.password ?? `Test-Password-${counter}-xyz`;
  const isFarmer = opts.role === 'FARMER';
  const phone = opts.phone ?? (isFarmer ? `98${String(10_000_000 + counter).padStart(8, '0')}` : undefined);
  const email = opts.email ?? (isFarmer ? undefined : `${opts.role.toLowerCase()}${counter}@example.test`);
  const protectedPhone = phone ? core.protector.protectPhone(phone) : null;
  const user = await UserModel.create({
    name: opts.name ?? `${opts.role} ${counter}`,
    role: opts.role,
    email,
    phone: protectedPhone ?? undefined,
    status: opts.status ?? 'ACTIVE',
    extraPermissions: opts.extraPermissions ?? [],
    preferredLanguage: opts.preferredLanguage ?? 'ta',
    passwordHash: await core.hasher.hash(password),
    expertProfile: opts.role === 'EXPERT' ? { specializations: [], languages: ['ta', 'en'], ...opts.expertProfile } : undefined,
  });
  const id = user._id.toHexString();
  const { token } = await core.tokens.issueAccessToken({ id, tokenVersion: 0, role: opts.role });
  return { user, id, password, authorization: `Bearer ${token}`, phone, email };
}
