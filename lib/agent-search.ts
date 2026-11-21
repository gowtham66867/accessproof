import type { SearchHit } from "./agent";
export async function searchAgentSources(
  query: string,
  key: string,
  request: typeof fetch = fetch,
): Promise<SearchHit[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.search = new URLSearchParams({
    engine: "google",
    q: query,
    hl: "en",
    gl: "in",
    api_key: key,
  }).toString();
  const response = await request(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Research search unavailable.");
  const data = await response.json();
  if (data.error) throw new Error("Research search unavailable.");
  return Array.isArray(data.organic_results)
    ? data.organic_results.slice(0, 8)
    : [];
}
