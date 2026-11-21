import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizedDemoRequest } from "@/lib/demo-auth";
import { createRoomSchema } from "@/lib/room-validation";
import { runResearchAgent, type AgentResearch } from "@/lib/agent";
import { searchTavilySources } from "@/lib/tavily";
import { demoSearch } from "@/lib/demo";
export const runtime = "nodejs";
const schema = z.object({
  venue: createRoomSchema.shape.venue,
  requirement: z.enum(["entrance", "seating", "restroom"]),
  mode: z.enum(["demo", "live"]),
  needsDetails: z.boolean().optional(),
});
const cache = new Map<
  string,
  { expires: number; job: Promise<AgentResearch> }
>();
let starts: number[] = [];
export async function POST(request: Request) {
  if (!authorizedDemoRequest(request))
    return NextResponse.json(
      { error: "Unlock the demo before running the research agent." },
      { status: 401 },
    );
  try {
    if (
      new URL(request.headers.get("origin") ?? "").host !==
      request.headers.get("host")
    )
      return NextResponse.json(
        { error: "Run the agent from AccessProof." },
        { status: 403 },
      );
  } catch {
    return NextResponse.json(
      { error: "Run the agent from AccessProof." },
      { status: 403 },
    );
  }
  const body = await request.text();
  if (body.length > 30000)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let parsed;
  try {
    parsed = schema.safeParse(JSON.parse(body));
  } catch {
    return NextResponse.json(
      { error: "Invalid research request." },
      { status: 400 },
    );
  }
  if (!parsed.success)
    return NextResponse.json(
      { error: "Check the venue and feature." },
      { status: 400 },
    );
  const input = parsed.data;
  if (input.mode === "demo") {
    const canonical = demoSearch().venues.find((v) => v.id === input.venue.id);
    if (!canonical)
      return NextResponse.json(
        { error: "Choose a fictional demo venue, or use live research." },
        { status: 400 },
      );
    let demoChecks = 0;
    const result = await runResearchAgent(
      { ...input, venue: { ...canonical, evidence: input.venue.evidence } },
      async () => {
        demoChecks++;
        return [
          {
            title: `${canonical.name} access note — fictional`,
            link: "https://example.com/fictional-access-note",
            snippet: `${canonical.name} in ${canonical.address} has an entrance report. Toilet details still need confirmation. This is a fictional research fixture.`,
          },
          {
            title: `${canonical.name} visitor question — fictional`,
            link: "https://example.org/fictional-visitor-question",
            snippet: `${canonical.name} in ${canonical.address} wheelchair access and toilet route need checking. Fictional example, not a real venue report.`,
          },
        ].slice(demoChecks === 1 ? 0 : 1, demoChecks === 1 ? 1 : 2);
      },
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  const key = process.env.TAVILY_API_KEY;
  if (!key)
    return NextResponse.json(
      { error: "Live research needs the configured Tavily key." },
      { status: 503 },
    );
  const time = Date.now();
  for (const [k, v] of cache) if (v.expires <= time) cache.delete(k);
  const cacheKey = JSON.stringify([
    input.venue.name,
    input.venue.address,
    input.requirement,
    input.needsDetails,
    input.venue.evidence[input.requirement],
  ]);
  const hit = cache.get(cacheKey);
  if (hit)
    return NextResponse.json(
      { ...(await hit.job), reused: true },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-AccessProof-Agent-Cache": "hit",
        },
      },
    );
  starts = starts.filter((t) => t > time - 3600000);
  if (starts.length >= 4)
    return NextResponse.json(
      {
        error:
          "The demo research allowance is reached. Reuse a recent result or try the fictional scenario.",
      },
      { status: 429 },
    );
  starts.push(time);
  if (cache.size >= 20) cache.delete(cache.keys().next().value!);
  const job = runResearchAgent(input, (q) => searchTavilySources(q, key));
  cache.set(cacheKey, { expires: time + 600000, job });
  try {
    return NextResponse.json(await job, {
      headers: {
        "Cache-Control": "no-store",
        "X-AccessProof-Agent-Cache": "miss",
      },
    });
  } catch {
    cache.delete(cacheKey);
    return NextResponse.json(
      {
        error:
          "Research could not complete. Existing reports remain unchanged.",
      },
      { status: 502 },
    );
  }
}
