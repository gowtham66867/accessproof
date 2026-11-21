import { NextRequest, NextResponse } from "next/server";
import { demoSearch } from "@/lib/demo";
import { cachedVenueSearch } from "@/lib/search-cache";
import { searchVenues } from "@/lib/serpapi";
import { authorizedDemoRequest } from "@/lib/demo-auth";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("mode") ?? "demo";
  if (mode === "live" && !authorizedDemoRequest(request))
    return NextResponse.json(
      { error: "Unlock the demo before running live search." },
      { status: 401 },
    );
  if (mode === "demo")
    return NextResponse.json(demoSearch(), {
      headers: { "Cache-Control": "no-store" },
    });
  if (mode !== "live")
    return NextResponse.json(
      { error: "Choose demo or live search." },
      { status: 400 },
    );
  const query = (params.get("q") ?? "").trim();
  const location = (params.get("location") ?? "").trim();
  if (!query || !location || query.length > 100 || location.length > 160)
    return NextResponse.json(
      {
        error:
          "Enter a venue type (up to 100 characters) and location (up to 160 characters).",
      },
      { status: 400 },
    );
  const key = process.env.SERPAPI_API_KEY;
  if (!key)
    return NextResponse.json(
      {
        error:
          "Live search needs a SerpApi key. Add SERPAPI_API_KEY to .env.local and restart the server, or switch to the demo.",
      },
      { status: 503 },
    );
  try {
    const { result, cached } = await cachedVenueSearch(query, location, () =>
      searchVenues(query, location, key),
    );
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-AccessProof-Cache": cached ? "hit" : "miss",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SEARCH_LIMIT")
      return NextResponse.json(
        {
          error:
            "The live demo has reached its search allowance for this hour. Try a recent search or explore the fictional demo.",
        },
        { status: 429 },
      );
    return NextResponse.json(
      {
        error:
          "Live search could not complete. Check your SerpApi key, available credits, and connection, then try again.",
      },
      { status: 502 },
    );
  }
}
