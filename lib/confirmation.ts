import type { AgentResearch } from "./agent";
import {
  evidenceStatus,
  statusLabels,
  requirements,
  type Evidence,
  type Requirement,
  type Venue,
} from "./evidence";

export type RoomRole = "visitor" | "representative";
export type RoomMode = "nexconn" | "rehearsal";
export type RoomMessage = {
  id: string;
  role: RoomRole;
  author: string;
  text: string;
  createdAt: string;
  requirement?: Requirement;
  answer?: "available" | "unavailable" | "unsure";
  delivery: "pending" | "delivered" | "failed";
  providerMessageId?: string;
  deliveredAt?: string;
};
export type RoomSnapshot = {
  id: string;
  mode: RoomMode;
  role: RoomRole;
  venue: Venue;
  datasetMode: "demo" | "live";
  requirement: Requirement;
  messages: RoomMessage[];
  research?: AgentResearch;
  createdAt: string;
  expiresAt: string;
};
export type RoomAccess = {
  id: string;
  key: string;
  representativeKey?: string;
};
export const questionFor = (id: Requirement) =>
  id === "entrance"
    ? "Is there a step-free route from the street to the seating area? Please describe steps, thresholds, ramps, doorway clearance, or any lift required."
    : id === "seating"
      ? "Can a wheelchair user reach and use the seating area? Which floor is it on, and is the route step-free?"
      : "Is there a wheelchair-accessible toilet? Is the route step-free, and are grab rails and turning space available?";

export function reportFromMessage(
  message: RoomMessage,
  room: Pick<RoomSnapshot, "id" | "mode">,
): Evidence | null {
  if (
    message.delivery !== "delivered" ||
    message.role !== "representative" ||
    !message.requirement ||
    !message.answer ||
    message.answer === "unsure"
  )
    return null;
  return {
    id: message.id,
    kind: "representative",
    author: message.author,
    roomId: room.id,
    transport: room.mode,
    supports: message.answer === "available",
    excerpt: message.text,
    source: `${message.author} · invited representative${room.mode === "rehearsal" ? " · local rehearsal" : " · via Nexconn"}`,
    retrievedAt: message.createdAt,
    publishedAt: message.createdAt,
  };
}
export function withRoomEvidence(
  venue: Venue,
  messages: RoomMessage[],
  room: Pick<RoomSnapshot, "id" | "mode">,
): Venue {
  const evidence = Object.fromEntries(
    requirements.map((req) => [
      req.id,
      venue.evidence[req.id].filter((e) => e.roomId !== room.id),
    ]),
  ) as Venue["evidence"];
  // Retain every report, including contradictory answers; stable message IDs prevent duplicates.
  for (const message of messages) {
    const report = reportFromMessage(message, room);
    if (
      report &&
      message.requirement &&
      !evidence[message.requirement].some((e) => e.id === report.id)
    )
      evidence[message.requirement].push(report);
  }
  return { ...venue, evidence };
}

export function evidenceUpdates(before: RoomSnapshot, next: RoomSnapshot) {
  return next.messages
    .filter(
      (message) =>
        reportFromMessage(message, next) &&
        !before.messages.some(
          (old) => old.id === message.id && old.delivery === "delivered",
        ),
    )
    .map((message) => {
      const requirement = message.requirement!;
      return {
        id: message.id,
        requirement,
        author: message.author,
        text: message.text,
        createdAt: message.createdAt,
        before: evidenceStatus(before.venue.evidence[requirement]),
        after: evidenceStatus(next.venue.evidence[requirement]),
        venueId: next.venue.id,
        venueName: next.venue.name,
      };
    });
}
export type EvidenceUpdate = ReturnType<typeof evidenceUpdates>[number];
export function updateAnnouncement(update: EvidenceUpdate) {
  return `${update.venueName}: ${requirements.find((r) => r.id === update.requirement)?.short} changed from ${statusLabels[update.before]} to ${statusLabels[update.after]}. Reported by ${update.author}. Earlier evidence retained.`;
}
