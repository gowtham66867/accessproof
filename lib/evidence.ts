export const requirements = [
  {
    id: "entrance",
    label: "Wheelchair-accessible entrance",
    short: "Entrance",
    attribute: "Wheelchair accessible entrance",
  },
  {
    id: "seating",
    label: "Wheelchair-accessible seating",
    short: "Seating",
    attribute: "Wheelchair accessible seating",
  },
  {
    id: "restroom",
    label: "Wheelchair-accessible toilet",
    short: "Toilet",
    attribute: "Wheelchair accessible restroom",
  },
] as const;
export type Requirement = (typeof requirements)[number]["id"];
export type Evidence = {
  id?: string;
  kind?: "listing" | "representative";
  author?: string;
  roomId?: string;
  transport?: "nexconn" | "rehearsal";
  supports: boolean;
  excerpt: string;
  source: string;
  url?: string;
  retrievedAt: string;
  publishedAt?: string;
};
export type Status = "supported" | "unsupported" | "conflicting" | "unknown";
export type Venue = {
  id: string;
  name: string;
  address: string;
  category: string;
  rating?: number;
  mapsUrl?: string;
  evidence: Record<Requirement, Evidence[]>;
  warning?: string;
};
export type SearchResult = {
  mode: "demo" | "live";
  location: string;
  query: string;
  venues: Venue[];
  warnings: string[];
  retrievedAt: string;
};
export const statusLabels: Record<Status, string> = {
  supported: "Reported available",
  unsupported: "Reported unavailable",
  conflicting: "Conflicting reports",
  unknown: "Unknown",
};
export function evidenceStatus(evidence: Evidence[]): Status {
  if (!evidence.length) return "unknown";
  const positive = evidence.some((e) => e.supports);
  const negative = evidence.some((e) => !e.supports);
  return positive && negative
    ? "conflicting"
    : positive
      ? "supported"
      : "unsupported";
}
export function supportedCount(venue: Venue, selected: Requirement[]) {
  return selected.filter(
    (id) => evidenceStatus(venue.evidence[id]) === "supported",
  ).length;
}
type Extension = { accessibility?: unknown };
export type Place = {
  title?: string;
  data_id?: string;
  data_cid?: string;
  place_id?: string;
  address?: string;
  type?: string | string[];
  rating?: number;
  extensions?: Extension[];
  unsupported_extensions?: Extension[];
};
export function mapsUrl(place: Place) {
  const params = new URLSearchParams({
    api: "1",
    query: [place.title, place.address].filter(Boolean).join(" "),
  });
  if (place.place_id) params.set("query_place_id", place.place_id);
  return `https://www.google.com/maps/search/?${params}`;
}
export function extractEvidence(
  place: Place,
  retrievedAt: string,
): Venue["evidence"] {
  const result: Venue["evidence"] = { entrance: [], seating: [], restroom: [] };
  for (const [extensions, supports] of [
    [place.extensions, true],
    [place.unsupported_extensions, false],
  ] as const) {
    for (const extension of extensions ?? []) {
      if (!Array.isArray(extension.accessibility)) continue;
      for (const attribute of extension.accessibility) {
        if (typeof attribute !== "string") continue;
        const req = requirements.find(
          (r) => r.attribute.toLowerCase() === attribute.trim().toLowerCase(),
        );
        if (req)
          result[req.id].push({
            supports,
            excerpt: attribute,
            source: `Google Maps listing · ${supports ? "available" : "unavailable"} attribute`,
            url: mapsUrl(place),
            retrievedAt,
          });
      }
    }
  }
  return result;
}
