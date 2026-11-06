/**
 * Admin user store — GitHub-backed.
 *
 * The primary admin account is verified against environment variables:
 *   ADMIN_EMAIL
 *   ADMIN_PASSWORD_HASH
 *
 * Additional users are stored in data/users.json in the GitHub content repo.
 *
 * No Supabase dependency remains.
 */

import type { AppUser, UserRole } from '@/types';
import { readUsers, writeUsers, type StoredUser } from '@/lib/data-store';
import { hashPassword } from '@/lib/auth';

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  role: UserRole;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string;
  role?: UserRole;
}

const DEFAULT_ADMIN_EMAIL = 'admin@patelrestaurant.com';

export function isCloudAuthEnabled(): boolean {
  return true;
}

function toAppUser(u: StoredUser): AppUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export async function listUsers(): Promise<AppUser[]> {
  const data = await readUsers();
  const ghUsers = (data?.users || []).map(toAppUser);

  // Always include the env-based admin account
  const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const adminUser: AppUser = {
    id: 'admin-1',
    email: adminEmail,
    name: adminEmail.split('@')[0],
    role: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Don't duplicate if admin already exists in GitHub users
  if (!ghUsers.some((u) => u.email.toLowerCase() === adminEmail.toLowerCase())) {
    return [adminUser, ...ghUsers];
  }
  return ghUsers;
}

export async function createUser(input: CreateUserInput): Promise<AppUser> {
  const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  if (input.email.toLowerCase() === adminEmail.toLowerCase()) {
    throw new Error('This email is already used by the primary admin account.');
  }

  const data = (await readUsers()) || { users: [] };
  const users = data.users;

  // Check for duplicate email
  if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    throw new Error('A user with this email already exists.');
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date().toISOString();
  const newUser: StoredUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email: input.email,
    name: input.name || input.email.split('@')[0],
    role: input.role,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  users.push(newUser);
  await writeUsers({ users });

  return toAppUser(newUser);
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<AppUser> {
  if (id === 'admin-1') {
    throw new Error('The primary admin account cannot be modified here. Update environment variables instead.');
  }
  const data = (await readUsers()) || { users: [] };
  const users = data.users;
  const index = users.findIndex((u) => u.id === id);

  if (index === -1) {
    throw new Error('User not found.');
  }

  const user = users[index];

  if (input.email !== undefined) user.email = input.email;
  if (input.name !== undefined) user.name = input.name;
  if (input.role !== undefined) user.role = input.role;
  if (input.password !== undefined && input.password !== '') {
    user.passwordHash = await hashPassword(input.password);
  }
  user.updatedAt = new Date().toISOString();

  users[index] = user;
  await writeUsers({ users });

  return toAppUser(user);
}

export async function deleteUser(id: string): Promise<void> {
  if (id === 'admin-1') {
    throw new Error('The primary admin account cannot be deleted.');
  }
  const data = (await readUsers()) || { users: [] };
  const users = data.users;
  const index = users.findIndex((u) => u.id === id);

  if (index === -1) {
    throw new Error('User not found.');
  }

  users.splice(index, 1);
  await writeUsers({ users });
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<AppUser | null> {
  // Check GitHub-stored users
  const data = await readUsers();
  const users = data?.users || [];
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!user) return null;

  const { verifyAdminCredentials } = await import('@/lib/auth');
  // Use bcrypt directly
  const bcrypt = await import('bcryptjs');
  const isValid = await bcrypt.default.compare(password, user.passwordHash);
  if (!isValid) return null;

  return toAppUser(user);
}

export { DEFAULT_ADMIN_EMAIL };