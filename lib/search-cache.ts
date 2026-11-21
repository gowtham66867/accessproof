import type { SearchResult } from "./evidence";

// Deliberately small, in-process cache: no extra service or background worker.
export function createSearchCache({
  ttl = 600000,
  limit = 10,
  windowMs = 3600000,
  now = Date.now,
} = {}) {
  const entries = new Map<
    string,
    { expires: number; promise: Promise<SearchResult> }
  >();
  let started: number[] = [];
  return async (
    query: string,
    location: string,
    load: () => Promise<SearchResult>,
  ) => {
    const time = now();
    for (const [key, entry] of entries)
      if (entry.expires <= time) entries.delete(key);
    const key = JSON.stringify([
      query.trim().toLocaleLowerCase(),
      location.trim().toLocaleLowerCase(),
    ]);
    const hit = entries.get(key);
    if (hit) return { result: await hit.promise, cached: true };
    started = started.filter((t) => t > time - windowMs);
    if (started.length >= limit) throw new Error("SEARCH_LIMIT");
    started.push(time);
    if (entries.size >= 30) entries.delete(entries.keys().next().value!);
    const promise = load();
    entries.set(key, { expires: time + ttl, promise });
    try {
      return { result: await promise, cached: false };
    } catch (error) {
      entries.delete(key);
      throw error;
    }
  };
}
export const cachedVenueSearch = createSearchCache();
