import { reportFromMessage, withRoomEvidence, type RoomSnapshot } from "./confirmation";
import { evidenceStatus, requirements, statusLabels } from "./evidence";
export type TimelineEvent = { id: string; label: string; detail: string; at: string; state: "done" | "pending" | "failed" | "unresolved" };
/** Derived from durable research and acknowledged messages, never optimistic UI state. */
export function roomTimeline(room: RoomSnapshot): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (room.research) {
    const run = room.research;
    const checks = run.trace.filter(s => s.tool === "search_web");
    const failed = checks.length > 0 && checks.every(s => s.observation.includes("Provider unavailable"));
    events.push({ id: "research:" + run.id, label: "Sources checked", detail: `${run.mode === "demo" ? "Fictional fixtures" : "Tavily"} · ${run.clues.length} cited clues · ${run.callsUsed} checks${run.reused ? " (cached run)" : ""}. Table unchanged.`, at: run.finishedAt, state: failed ? "failed" : "done" });
  }
  const messages = [...new Map(room.messages.map(m => [m.id, m])).values()];
  const question = messages.find(m => m.role === "visitor");
  if (question) {
    events.push({ id: "review:" + question.id, label: room.research ? "Question reviewed" : "Question saved", detail: question.text, at: room.createdAt, state: "done" });
    events.push({ id: "send:" + question.id, label: question.delivery === "delivered" ? "Question delivered" : question.delivery === "failed" ? "Question delivery failed" : "Question delivery pending", detail: room.mode === "nexconn" ? "Private Nexconn room · no automatic business outreach." : "Local rehearsal · not Nexconn.", at: question.deliveredAt || question.createdAt, state: question.delivery === "delivered" ? "done" : question.delivery });
  }
  const base = { ...room.venue, evidence: Object.fromEntries(requirements.map(r => [r.id, room.venue.evidence[r.id].filter(e => e.roomId !== room.id)])) as RoomSnapshot["venue"]["evidence"] };
  const processed: typeof messages = [];
  for (const message of messages) {
    const before = withRoomEvidence(base, processed, room);
    processed.push(message);
    if (message.role !== "representative") continue;
    const at = message.deliveredAt || message.createdAt;
    events.push({ id: "reply:" + message.id, label: message.delivery !== "delivered" ? `Reply ${message.delivery === "failed" ? "delivery failed" : "pending"}` : message.answer === "unsure" ? "Representative needs to check" : "Representative replied", detail: `${message.author}: ${message.text}`, at, state: message.delivery !== "delivered" ? message.delivery : message.answer === "unsure" ? "unresolved" : "done" });
    if (!reportFromMessage(message, room) || !message.requirement) continue;
    const after = withRoomEvidence(base, processed, room);
    const prev = evidenceStatus(before.evidence[message.requirement]), next = evidenceStatus(after.evidence[message.requirement]);
    events.push({ id: "table:" + message.id, label: `Table: ${statusLabels[prev]} → ${statusLabels[next]}`, detail: `${requirements.find(r => r.id === message.requirement)?.short} · ${message.author}. Earlier evidence retained.${next === "conflicting" ? " Disagreement needs a fresh check." : " Attributed report; specific fit may still need confirmation."}`, at, state: next === "conflicting" ? "unresolved" : "done" });
  }
  return events;
}
