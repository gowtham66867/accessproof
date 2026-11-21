import {
  evidenceStatus,
  requirements,
  type Requirement,
  type Status,
  type Venue,
} from "./evidence";
import { questionFor } from "./confirmation";
export type ResearchClue = {
  title: string;
  url: string;
  excerpt: string;
  domain: string;
  retrievedAt: string;
};
export type AgentStep = {
  tool:
    | "inspect_evidence"
    | "search_web"
    | "assess_sources"
    | "draft_question"
    | "human_checkpoint";
  action: string;
  observation: string;
  at: string;
};
export type AgentResearch = {
  id: string;
  mode: "live" | "demo";
  provider: "tavily" | "fixtures";
  requirement: Requirement;
  statusBefore: Status;
  trace: AgentStep[];
  clues: ResearchClue[];
  draftQuestion: string;
  stoppingReason: string;
  callsUsed: number;
  maxCalls: 2;
  startedAt: string;
  finishedAt: string;
  reused?: boolean;
  policy: "bounded-tool-agent";
};
export type SearchHit = { title?: string; link?: string; snippet?: string };
export type ResearchInput = {
  venue: Venue;
  requirement: Requirement;
  needsDetails?: boolean;
  mode: "live" | "demo";
};
const searchName = (name: string) => name.split(/[:,|]|\s[-–]\s/)[0].trim();
const words = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
export function relevantClues(
  hits: SearchHit[],
  venue: Venue,
  at: string,
): ResearchClue[] {
  const name = words(searchName(venue.name));
  const phrase = name.join(" ");
  const locality = words(venue.address).filter(
    (w) =>
      w.length > 4 &&
      ![
        "india",
        "street",
        "building",
        "karnataka",
        "stage",
        "phase",
        "floor",
        "first",
        "second",
        "third",
        "north",
        "south",
      ].includes(w),
  );
  return hits.flatMap((hit) => {
    if (!hit.link || !hit.title || !hit.snippet) return [];
    let url: URL;
    try {
      url = new URL(hit.link);
    } catch {
      return [];
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
      return [];
    const content = words(hit.title + " " + hit.snippet).join(" ");
    const sameVenue =
      content.includes(phrase) &&
      (locality.length === 0 || locality.some((w) => content.includes(w)));
    if (
      !sameVenue ||
      !/(wheelchair|accessib|step|ramp|toilet|restroom|door|seating|lift)/i.test(
        content,
      )
    )
      return [];
    return [
      {
        title: hit.title.slice(0, 220),
        url: url.toString().slice(0, 1500),
        excerpt: hit.snippet.split(/\s+/).slice(0, 24).join(" "),
        domain: url.hostname.replace(/^www\./, ""),
        retrievedAt: at,
      },
    ];
  });
}
export async function runResearchAgent(
  input: ResearchInput,
  search: (query: string) => Promise<SearchHit[]>,
  now = () => new Date().toISOString(),
): Promise<AgentResearch> {
  const startedAt = now();
  const trace: AgentStep[] = [];
  let callsUsed = 0;
  const clues: ResearchClue[] = [];
  const statusBefore = evidenceStatus(input.venue.evidence[input.requirement]);
  const step = (tool: AgentStep["tool"], action: string, observation: string) =>
    trace.push({ tool, action, observation, at: now() });
  step(
    "inspect_evidence",
    `Inspect ${requirements.find((r) => r.id === input.requirement)?.short.toLowerCase()} evidence`,
    `${statusBefore}; ${input.venue.evidence[input.requirement].length} existing reports. ${input.needsDetails ? "A specific detail also needs confirmation." : ""}`,
  );
  const feature =
    input.requirement === "restroom"
      ? "wheelchair accessible toilet restroom step free route"
      : input.requirement === "entrance"
        ? "wheelchair accessible entrance steps doorway ramp"
        : "wheelchair accessible seating step free route floor";
  const location = input.venue.address
    .split(",")
    .slice(-3)
    .join(" ")
    .replace(/\b\d{4,}\b/g, "")
    .replace(/\b(India|Karnataka)\b/gi, "")
    .slice(0, 80)
    .replace(/["\r\n]/g, " ")
    .trim();
  if (statusBefore !== "supported" || input.needsDetails) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const query =
        attempt === 0
          ? `"${searchName(input.venue.name).replace(/"/g, "")}" ${location} ${feature}`
          : `"${searchName(input.venue.name).replace(/"/g, "")}" ${location} reviews accessibility ${input.requirement === "restroom" ? "toilet grab rails turning space" : "steps access route"}`;
      callsUsed++;
      try {
        const hits = await search(query);
        const accepted = relevantClues(hits, input.venue, now());
        for (const clue of accepted)
          if (!clues.some((c) => c.url === clue.url) && clues.length < 6)
            clues.push(clue);
        step(
          "search_web",
          attempt === 0
            ? "Search public venue access details"
            : "Replan: search reviews and route details",
          `${input.mode === "demo" ? "Illustrative tool response. " : ""}${hits.length} results; ${accepted.length} venue-matched research clues. Query: ${query}`,
        );
      } catch {
        step(
          "search_web",
          attempt === 0
            ? "Search public venue access details"
            : "Replan: try the follow-up search",
          "Provider unavailable. No evidence was inferred from this failure.",
        );
      }
      const domains = new Set(clues.map((c) => c.domain)).size;
      step(
        "assess_sources",
        "Check relevance, duplicate links and source variety",
        `${clues.length} clues across ${domains} distinct domains. Snippets remain unverified clues.`,
      );
      if (domains >= 2) break;
    }
  } else {
    step(
      "assess_sources",
      "Avoid unnecessary tool calls",
      "The selected feature already has a supporting report without a contradiction. Confirm current conditions with the representative if needed.",
    );
  }
  let draftQuestion =
    (statusBefore === "conflicting"
      ? "Earlier reports disagree about this feature. Please confirm current conditions. "
      : "") + questionFor(input.requirement);
  draftQuestion +=
    " Please confirm whether the route is clear of stored items and available to visitors today.";
  if (clues.length)
    draftQuestion +=
      (input.mode === "demo" ? " Fictional research fixtures supplied these illustrative references;" : " Tavily search surfaced these possible references;") + " please confirm they refer to this venue and describe current conditions: " +
      clues
        .slice(0, 2)
        .map((c) => c.url.slice(0, 300))
        .join(" ");
  draftQuestion = draftQuestion.slice(0, 1150);
  step(
    "draft_question",
    "Draft a question for human review",
    "Question asks for current conditions and specific facilities. Private visit notes were not sent to search.",
  );
  const stoppingReason =
    callsUsed === 0
      ? "Existing reports found; no new search needed. Human confirmation remains available."
      : clues.length
        ? "Source checks complete. Search clues cannot establish accessibility; wait for an attributed representative report."
        : "No sufficiently matched research clues found. Keep the feature unresolved and ask the representative.";
  step("human_checkpoint", "Pause before contacting the venue", stoppingReason);
  return {
    id: crypto.randomUUID(),
    mode: input.mode,
    provider: input.mode === "demo" ? "fixtures" : "tavily",
    requirement: input.requirement,
    statusBefore,
    trace,
    clues,
    draftQuestion,
    stoppingReason,
    callsUsed,
    maxCalls: 2,
    startedAt,
    finishedAt: now(),
    policy: "bounded-tool-agent",
  };
}
