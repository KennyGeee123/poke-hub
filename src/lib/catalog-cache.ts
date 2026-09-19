/** IndexedDB catalog cache — set lists + per-set card payloads (escapes localStorage). */
const DB = "pokevault-catalog";
const VER = 1;
const STORE = "sets";

export type CatalogCacheInfo = {
  backend: "idb" | "none";
  setCount: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result as T | undefined);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return undefined;
  }
}

async function idbPut(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* private mode / quota */
  }
}

type Envelope<T> = { at: number; data: T };

const SETS_KEY = "sets:all";
const setKey = (id: string) => `set:${id}:cards`;

export async function getCachedSets<T>(maxAgeMs = 24 * 60 * 60 * 1000): Promise<T | null> {
  const env = await idbGet<Envelope<T>>(SETS_KEY);
  if (!env?.data) return null;
  if (Date.now() - env.at > maxAgeMs) return null;
  return env.data;
}

export async function setCachedSets<T>(data: T): Promise<void> {
  await idbPut(SETS_KEY, { at: Date.now(), data } satisfies Envelope<T>);
}

export async function getCachedSetCards<T>(setId: string, maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<T | null> {
  const env = await idbGet<Envelope<T>>(setKey(setId));
  if (!env?.data) return null;
  if (Date.now() - env.at > maxAgeMs) return null;
  return env.data;
}

export async function setCachedSetCards<T>(setId: string, data: T): Promise<void> {
  await idbPut(setKey(setId), { at: Date.now(), data } satisfies Envelope<T>);
}

export async function getCatalogCacheInfo(): Promise<CatalogCacheInfo> {
  try {
    const db = await openDb();
    const count = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).count();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return { backend: "idb", setCount: count };
  } catch {
    return { backend: "none", setCount: 0 };
  }
}
