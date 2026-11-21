import {
  extractEvidence,
  mapsUrl,
  type Place,
  type SearchResult,
  type Venue,
} from "./evidence";

type Payload = {
  error?: string;
  local_results?: Place[];
  place_results?: Place;
};
export async function searchVenues(
  query: string,
  location: string,
  key: string,
  request: typeof fetch = fetch,
): Promise<SearchResult> {
  async function call(params: Record<string, string>): Promise<Payload> {
    const url = new URL("https://serpapi.com/search.json");
    url.search = new URLSearchParams({
      engine: "google_maps",
      hl: "en",
      api_key: key,
      ...params,
    }).toString();
    const response = await request(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        "Venue search provider could not complete the request. Check your API key and credits.",
      );
    const payload = (await response.json()) as Payload;
    // Provider error messages may contain request details: never return them to the browser.
    if (payload.error)
      throw new Error(
        "Venue search provider returned an error. Check your API key and credits.",
      );
    return payload;
  }
  const search = await call({ q: `${query} in ${location}`, type: "search" });
  const retrievedAt = new Date().toISOString();
  const places = (
    search.local_results ?? (search.place_results ? [search.place_results] : [])
  ).slice(0, 5);
  const venues = await Promise.all(
    places.map(async (place, index): Promise<Venue> => {
      let details = place;
      let warning: string | undefined;
      if (place.place_id || place.data_cid) {
        try {
          const response = await call(
            place.place_id
              ? { place_id: place.place_id }
              : { data_cid: place.data_cid! },
          );
          if (!response.place_results) throw new Error("No details");
          details = { ...place, ...response.place_results };
        } catch {
          warning =
            "Place details could not be retrieved. Accessibility evidence may be incomplete.";
        }
      } else {
        warning =
          "No place identifier was available for detail retrieval. Accessibility evidence may be incomplete.";
      }
      return {
        id: place.data_id ?? place.place_id ?? `result-${index}`,
        name: details.title ?? "Unnamed venue",
        address: details.address ?? "Address unavailable",
        category: Array.isArray(details.type)
          ? details.type.join(" · ")
          : (details.type ?? "Venue"),
        rating: details.rating,
        mapsUrl: mapsUrl(details),
        evidence: extractEvidence(details, retrievedAt),
        warning,
      };
    }),
  );
  return {
    mode: "live",
    location,
    query,
    venues,
    retrievedAt,
    warnings: venues.some((v) => v.warning)
      ? [
          "Some place details were unavailable. A missing report is not evidence that a feature is absent.",
        ]
      : [],
  };
}
