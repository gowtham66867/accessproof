import {
  evidenceStatus,
  requirements,
  statusLabels,
  supportedCount,
  type Requirement,
  type Venue,
} from "./evidence";
export function visitSummary(
  venues: Venue[],
  selected: Requirement[],
  details: Partial<Record<Requirement, string>>,
) {
  return [
    "AccessProof · My visit summary",
    "Reports are attributed claims. Specific fit and current conditions may need confirmation.",
    ...venues.flatMap((venue) => [
      "",
      venue.name,
      venue.address,
      venue.mapsUrl ?? "Fictional demo venue · not a real listing",
      `${supportedCount(venue, selected)} of ${selected.length} selected features have supporting reports without contradictions.`,
      ...requirements
        .filter((r) => selected.includes(r.id))
        .flatMap((req) => [
          `${req.short}: ${statusLabels[evidenceStatus(venue.evidence[req.id])]}`,
          ...(details[req.id]
            ? [`Specific detail to confirm: ${details[req.id]}`]
            : []),
          ...venue.evidence[req.id].map(
            (e) =>
              `  ${e.excerpt} — ${e.source}. ${e.publishedAt ? "Reported" : "Retrieved"} ${e.publishedAt ?? e.retrievedAt}${e.url ? ` · ${e.url}` : ""}`,
          ),
          ...(!venue.evidence[req.id].length
            ? ["  Outstanding question: no explicit feature report found."]
            : []),
        ]),
    ]),
  ].join("\n");
}
