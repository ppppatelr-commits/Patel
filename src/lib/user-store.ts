import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppUser, UserRole } from '@/types';

/**
 * Dashboard account storage.
 *
 * Backend selection:
 *  - Cloud  : when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.
 *             Accounts live in Supabase Auth; the role is stored in app_metadata.role.
 *  - Local  : otherwise, accounts are stored in data/users.json on the server.
 *
 * Passwords are always hashed (scrypt) for the local backend and managed by
 * Supabase Auth for the cloud backend. Plain-text passwords are never stored.
 */

interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  salt: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

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
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const MIN_PASSWORD_LENGTH = 6;

// ── Cloud (Supabase) helpers ───────────────────────────────────────────

function supabaseUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url || !url.startsWith('http')) return undefined;
  if (url.includes('YOUR-PROJECT-REF') || url.includes('your-project-ref')) return undefined;
  return url;
}

function supabaseAnonKey(): string | undefined {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!key || key.length < 10 || key.includes('YOUR-ANON')) return undefined;
  return key;
}

function supabaseServiceKey(): string | undefined {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || key.length < 10 || key.includes('YOUR-')) return undefined;
  return key;
}

function supabaseAdmin(): SupabaseClient | null {
  const url = supabaseUrl();
  const key = supabaseServiceKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** True when dashboard accounts are managed by Supabase Auth. */
export function isCloudAuthEnabled(): boolean {
  return supabaseAdmin() !== null;
}

function mapSupabaseUser(user: {
  id: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): AppUser {
  const appRole = user.app_metadata?.role;
  const metaRole = user.user_metadata?.role;
  const role: UserRole = appRole === 'admin' || metaRole === 'admin' ? 'admin' : 'user';
  const metaName = user.user_metadata?.name;
  const email = user.email || '';
  const created = user.created_at || new Date().toISOString();
  return {
    id: user.id,
    email,
    name: typeof metaName === 'string' && metaName.trim() ? metaName.trim() : email.split('@')[0] || 'User',
    role,
    createdAt: created,
    updatedAt: user.updated_at || created,
  };
}

// ── Local (file) helpers ───────────────────────────────────────────────

function usersFile(): string {
  // Statically scoped to the ./data folder so the bundler does not trace the
  // whole project when reading user accounts.
  return path.join(process.cwd(), 'data', 'users.json');
}

function makeSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function passwordMatches(password: string, user: StoredUser): boolean {
  const actual = Buffer.from(hashPassword(password, user.salt), 'hex');
  const expected = Buffer.from(user.passwordHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function toPublic(user: StoredUser): AppUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function defaultAdmin(): StoredUser {
  const now = new Date().toISOString();
  const salt = makeSalt();
  return {
    id: crypto.randomUUID(),
    email: DEFAULT_ADMIN_EMAIL,
    name: 'Administrator',
    role: 'admin',
    salt,
    passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD, salt),
    createdAt: now,
    updatedAt: now,
  };
}

// In-process cache so the app still works on a read-only filesystem.
let cache: StoredUser[] | null = null;

async function persist(users: StoredUser[]): Promise<void> {
  cache = users;
  const file = usersFile();
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ users }, null, 2), 'utf8');
  } catch (err) {
    // Read-only filesystem (e.g. serverless). Keep the in-memory copy so the
    // current process still works, but tell the caller persistence failed.
    throw new Error(
      'Could not save user data to disk. For permanent cloud storage configure Supabase (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).'
    );
  }
}

async function loadUsers(): Promise<StoredUser[]> {
  if (cache) return cache;
  const file = usersFile();
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as { users?: StoredUser[] } | StoredUser[];
    const users = Array.isArray(parsed) ? parsed : parsed.users;
    cache = Array.isArray(users) ? users : [];
    return cache;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') throw err;
    // First run: create the default administrator.
    cache = [defaultAdmin()];
    try {
      await persist(cache);
    } catch {
      // Read-only filesystem: keep the seeded admin in memory.
    }
    return cache;
  }
}

// Serialise writes so two requests cannot clobber each other.
let writeQueue: Promise<unknown> = Promise.resolve();
function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validatePassword(password: string): void {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

async function fileListUsers(): Promise<AppUser[]> {
  const users = await loadUsers();
  return [...users]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toPublic);
}

async function fileCreateUser(input: CreateUserInput): Promise<AppUser> {
  const email = normaliseEmail(input.email);
  if (!email || !email.includes('@')) throw new Error('A valid email address is required.');
  validatePassword(input.password);

  return withWriteLock(async () => {
    const users = await loadUsers();
    if (users.some((u) => u.email.toLowerCase() === email)) {
      throw new Error('A user with this email already exists.');
    }
    const salt = makeSalt();
    const now = new Date().toISOString();
    const user: StoredUser = {
      id: crypto.randomUUID(),
      email,
      name: input.name?.trim() || email.split('@')[0],
      role: input.role === 'admin' ? 'admin' : 'user',
      salt,
      passwordHash: hashPassword(input.password, salt),
      createdAt: now,
      updatedAt: now,
    };
    await persist([...users, user]);
    return toPublic(user);
  });
}

async function fileUpdateUser(id: string, input: UpdateUserInput): Promise<AppUser> {
  return withWriteLock(async () => {
    const users = await loadUsers();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) throw new Error('User not found.');

    const current = users[index];
    const next: StoredUser = { ...current };

    if (input.email !== undefined) {
      const email = normaliseEmail(input.email);
      if (!email || !email.includes('@')) throw new Error('A valid email address is required.');
      if (users.some((u) => u.id !== id && u.email.toLowerCase() === email)) {
        throw new Error('A user with this email already exists.');
      }
      next.email = email;
    }

    if (input.name !== undefined) {
      next.name = input.name.trim() || next.email.split('@')[0];
    }

    if (input.role !== undefined) {
      if (current.role === 'admin' && input.role !== 'admin') {
        const admins = users.filter((u) => u.role === 'admin');
        if (admins.length <= 1) throw new Error('Cannot remove the last administrator.');
      }
      next.role = input.role;
    }

    if (input.password !== undefined && input.password !== '') {
      validatePassword(input.password);
      next.salt = makeSalt();
      next.passwordHash = hashPassword(input.password, next.salt);
    }

    next.updatedAt = new Date().toISOString();
    users[index] = next;
    await persist(users);
    return toPublic(next);
  });
}

async function fileDeleteUser(id: string): Promise<void> {
  return withWriteLock(async () => {
    const users = await loadUsers();
    const target = users.find((u) => u.id === id);
    if (!target) throw new Error('User not found.');
    if (target.role === 'admin' && users.filter((u) => u.role === 'admin').length <= 1) {
      throw new Error('Cannot delete the last administrator.');
    }
    await persist(users.filter((u) => u.id !== id));
  });
}

async function fileVerifyCredentials(email: string, password: string): Promise<AppUser | null> {
  const users = await loadUsers();
  const user = users.find((u) => u.email.toLowerCase() === normaliseEmail(email));
  if (!user) return null;
  if (!passwordMatches(password, user)) return null;
  return toPublic(user);
}

async function ensureDefaultAdmin(): Promise<void> {
  const admin = supabaseAdmin();
  if (!admin) return;
  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (!data?.users || data.users.length === 0) {
      await admin.auth.admin.createUser({
        email: DEFAULT_ADMIN_EMAIL,
        password: DEFAULT_ADMIN_PASSWORD,
        email_confirm: true,
        app_metadata: { role: 'admin' },
        user_metadata: { name: 'Administrator', role: 'admin' },
      });
    }
  } catch {
    // Best-effort; ignore errors.
  }
}

export async function listUsers(): Promise<AppUser[]> {
  const admin = supabaseAdmin();
  if (admin) {
    await ensureDefaultAdmin();
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);
    return (data?.users || []).map(mapSupabaseUser);
  }
  return fileListUsers();
}

export async function createUser(input: CreateUserInput): Promise<AppUser> {
  const admin = supabaseAdmin();
  if (admin) {
    const email = normaliseEmail(input.email);
    if (!email || !email.includes('@')) throw new Error('A valid email address is required.');
    validatePassword(input.password);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      app_metadata: { role: input.role },
      user_metadata: { name: input.name?.trim() || '', role: input.role },
    });
    if (error) throw new Error(error.message);
    if (!data?.user) throw new Error('User could not be created.');
    return mapSupabaseUser(data.user);
  }
  return fileCreateUser(input);
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<AppUser> {
  const admin = supabaseAdmin();
  if (admin) {
    if (input.password !== undefined && input.password !== '') {
      validatePassword(input.password);
    }
    const payload: Record<string, any> = {};
    if (input.email !== undefined) payload.email = normaliseEmail(input.email);
    if (input.password) payload.password = input.password;
    if (input.role !== undefined) {
      payload.app_metadata = { role: input.role };
      payload.user_metadata = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        role: input.role,
      };
    } else if (input.name !== undefined) {
      payload.user_metadata = { name: input.name };
    }
    const { data, error } = await admin.auth.admin.updateUserById(id, payload);
    if (error) throw new Error(error.message);
    if (!data?.user) throw new Error('User could not be updated.');
    return mapSupabaseUser(data.user);
  }
  return fileUpdateUser(id, input);
}

export async function deleteUser(id: string): Promise<void> {
  const admin = supabaseAdmin();
  if (admin) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);
    return;
  }
  return fileDeleteUser(id);
}

export async function verifyCredentials(email: string, password: string): Promise<AppUser | null> {
  const admin = supabaseAdmin();
  if (admin) {
    await ensureDefaultAdmin();
    const url = supabaseUrl();
    const anonKey = supabaseAnonKey();
    if (!url || !anonKey) return null;
    const anon = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email: normaliseEmail(email), password });
    if (error || !data?.user) return null;
    return mapSupabaseUser(data.user);
  }
  return fileVerifyCredentials(email, password);
}
