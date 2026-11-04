import { Client } from 'pg';

let descriptionMigrated = false;
let settingsMigrated = false;

function getConnectionString(): string | null {
  const connStr =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL;
  if (!connStr) return null;
  // Strip sslmode from the connection string so our explicit ssl option wins.
  return connStr.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T | null> {
  const connStr = getConnectionString();
  if (!connStr) return null;
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    return await fn(client);
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Ensures the `description` column exists on `menu_items`.
 * Uses a direct Postgres connection (service role) so it works on Vercel
 * without manual SQL. Safe to call repeatedly.
 */
export async function ensureDescriptionColumn(): Promise<boolean> {
  if (descriptionMigrated) return true;

  try {
    const ok = await withClient(async (client) => {
      await client.query('ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS description text;');
      return true;
    });

    if (ok) descriptionMigrated = true;
    return ok === true;
  } catch (err) {
    console.error('ensureDescriptionColumn failed:', (err as Error).message);
    return false;
  }
}

/**
 * Ensures the `tagline` column exists on `restaurant_settings` and backfills
 * the default tagline for existing rows. Safe to call repeatedly.
 */
export async function ensureSettingsColumns(): Promise<boolean> {
  if (settingsMigrated) return true;

  try {
    const ok = await withClient(async (client) => {
      await client.query('ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS tagline text;');
      await client.query(
        `UPDATE public.restaurant_settings SET tagline = 'Premium Authentic Indian Cuisine' WHERE tagline IS NULL;`
      );
      return true;
    });

    if (ok) settingsMigrated = true;
    return ok === true;
  } catch (err) {
    console.error('ensureSettingsColumns failed:', (err as Error).message);
    return false;
  }
}
