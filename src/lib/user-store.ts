/**
 * Admin user store — Custom authentication (replaces Supabase Auth).
 *
 * Admin credentials are verified against environment variables:
 *   ADMIN_EMAIL
 *   ADMIN_PASSWORD_HASH
 *
 * Sessions use HttpOnly cookies (see src/lib/auth.ts).
 *
 * No Supabase dependency remains.
 */

import type { AppUser, UserRole } from '@/types';

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
  // Custom auth is always enabled (no Supabase)
  return true;
}

export async function listUsers(): Promise<AppUser[]> {
  // Single admin account from environment variables
  const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  return [
    {
      id: 'admin-1',
      email: adminEmail,
      name: adminEmail.split('@')[0],
      role: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

export async function createUser(input: CreateUserInput): Promise<AppUser> {
  // Custom auth supports a single admin account via env vars.
  // Additional users would require a user management system.
  return {
    id: 'admin-1',
    email: input.email,
    name: input.name || input.email.split('@')[0],
    role: input.role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<AppUser> {
  return {
    id,
    email: input.email || DEFAULT_ADMIN_EMAIL,
    name: input.name || 'Administrator',
    role: input.role || 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteUser(id: string): Promise<void> {
  // Custom auth has a single admin; deletion is not supported.
  throw new Error('Cannot delete the administrator account.');
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<AppUser | null> {
  // Import auth functions dynamically
  const { verifyAdminCredentials } = await import('@/lib/auth');
  const user = await verifyAdminCredentials(email, password);
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.email.split('@')[0],
    role: user.role as 'admin' | 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export { DEFAULT_ADMIN_EMAIL };