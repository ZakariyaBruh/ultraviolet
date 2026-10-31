import { get, set } from 'idb-keyval'

interface Entry<T> {
  at: number
  value: T
}

/** IndexedDB-backed cache; falls back to a straight fetch if IDB is unavailable. */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  let hit: Entry<T> | undefined
  try {
    hit = await get<Entry<T>>(key)
  } catch {
    /* private mode etc. */
  }
  if (hit && Date.now() - hit.at < ttlMs) return hit.value
  try {
    const value = await load()
    try {
      await set(key, { at: Date.now(), value } satisfies Entry<T>)
    } catch {
      /* ignore */
    }
    return value
  } catch (err) {
    if (hit) return hit.value // stale beats nothing
    throw err
  }
}
