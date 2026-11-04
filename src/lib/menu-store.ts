import fs from 'fs/promises';
import path from 'path';
import { buildSeedStore, type LocalMenuStore } from '@/lib/menu-seed';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'menu-store.json');

function isValidStore(value: unknown): value is LocalMenuStore {
  if (!value || typeof value !== 'object') return false;
  const store = value as Partial<LocalMenuStore>;
  return (
    store.version === 1 &&
    !!store.settings &&
    Array.isArray(store.categories) &&
    Array.isArray(store.items)
  );
}

/**
 * Read the live menu. Falls back to the PDF seed when no store exists yet.
 */
export async function readStore(): Promise<LocalMenuStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (isValidStore(parsed)) return parsed;
  } catch {
    // No store yet (or it was deleted) — seed from MENU_DATA.
  }
  return buildSeedStore();
}

export async function writeStore(store: LocalMenuStore): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

// Serialize read-modify-write cycles so two admin saves can never clobber
// each other.
let writeQueue: Promise<unknown> = Promise.resolve();

export function updateStore<T>(
  mutator: (store: LocalMenuStore) => T | Promise<T>
): Promise<T> {
  const run = writeQueue.then(async () => {
    const store = await readStore();
    const result = await mutator(store);
    await writeStore(store);
    return result;
  });
  writeQueue = run.catch(() => undefined);
  return run;
}

export { STORE_PATH };
