import type { SearchHit } from "./agent";

/** Search only: fixed basic depth, no generated answer or unbounded extraction. */
export async function searchTavilySources(
  query: string,
  key: string,
  request: typeof fetch = fetch,
): Promise<SearchHit[]> {
  if (!key.trim()) throw new Error("Tavily research is not configured.");
  const response = await request("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      topic: "general",
      max_results: 8,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      auto_parameters: false,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Tavily research unavailable.");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("results" in data) || !Array.isArray(data.results))
    throw new Error("Tavily research unavailable.");
  return data.results.slice(0, 8).flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const r = entry as Record<string, unknown>;
    if (typeof r.title !== "string" || typeof r.url !== "string" || typeof r.content !== "string") return [];
    return [{ title: r.title.slice(0, 220), link: r.url.slice(0, 1500), snippet: r.content.slice(0, 4000) }];
  });
}
