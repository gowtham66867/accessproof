import { evidenceStatus, requirements, type Requirement, type Venue } from "./evidence";
import type { ResearchClue } from "./agent";
export type ResearchBrief = {
  summary: string;
  reported: { feature: string; text: string; source: string; url?: string }[];
  findings: { text: string; citation: number }[];
  unanswered: string[];
  disagreement: string;
};
export function buildResearchBrief(venue: Venue, requirement: Requirement, clues: ResearchClue[]): ResearchBrief {
  const status = evidenceStatus(venue.evidence[requirement]);
  const reported = requirements.flatMap((feature) => venue.evidence[feature.id].slice(0, 2).map((e) => ({
    feature: feature.short,
    text: e.excerpt,
    source: e.source,
    ...(e.url ? { url: e.url } : {}),
  }))).slice(0, 4);
  const unanswered = requirement === "restroom"
    ? ["Does a step-free route continue from the entrance to the toilet?", "Are grab rails, doorway clearance and turning / transfer space available today?"]
    : requirement === "entrance"
      ? ["Is the route from the street to seating step-free today?", "What are the doorway clearance, thresholds and any ramp or lift requirements?"]
      : ["Can a wheelchair user reach the seating without steps?", "What table clearance and turning space are available, and on which floor?"];
  return {
    summary: clues.length ? `${clues.length} matched source ${clues.length === 1 ? "clue" : "clues"} to inspect. These excerpts do not establish current accessibility.` : "No sufficiently matched public-source clues. Keep this question open.",
    reported,
    // Extractive brief only: every finding is the exact bounded source excerpt.
    findings: clues.map((clue, i) => ({ text: clue.excerpt, citation: i + 1 })),
    unanswered,
    disagreement: status === "conflicting"
      ? "Existing reports disagree about this feature. Ask about current conditions; retain both reports."
      : "No disagreement has been established from this check. This is not confirmation that sources agree or conditions are unchanged.",
  };
}
