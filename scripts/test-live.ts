import { evidenceStatus, requirements } from "../lib/evidence";
import { searchVenues } from "../lib/serpapi";

const key = process.env.SERPAPI_API_KEY?.trim();
if (!key) {
  console.error("Add SERPAPI_API_KEY to .env.local, then run npm run test:live again. Never paste the key into chat.");
  process.exitCode = 1;
} else {
  const started = Date.now();
  try {
    const result = await searchVenues("cafes", "Indiranagar, Bengaluru, Karnataka, India", key);
    if (!result.venues.length) {
      console.error("Search completed but returned no cafés. Inspect the provider configuration before the demo.");
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({
        query: result.query,
        location: result.location,
        elapsedSeconds: Number(((Date.now() - started) / 1000).toFixed(1)),
        retrievedAt: result.retrievedAt,
        venues: result.venues.map(venue => ({
          name: venue.name,
          address: venue.address,
          listing: venue.mapsUrl,
          requirements: Object.fromEntries(requirements.map(req => [req.id, {
            status: evidenceStatus(venue.evidence[req.id]),
            reports: venue.evidence[req.id].map(e => ({ excerpt: e.excerpt, supports: e.supports, source: e.source, url: e.url })),
          }])),
          warning: venue.warning,
        })),
        warnings: result.warnings,
      }, null, 2));
      console.log("Live retrieval completed. Check each address belongs to the requested area; unknown attributes are a valid result, not an accessibility verdict.");
    }
  } catch {
    console.error("Live search failed. Check the key, credits, and network. Provider request URLs and credentials are intentionally omitted.");
    process.exitCode = 1;
  }
}
