import type { RoomSnapshot } from "@/lib/confirmation";
import { roomTimeline } from "@/lib/timeline";
export default function LiveTimeline({ snapshot }: { snapshot: RoomSnapshot }) {
  const events = roomTimeline(snapshot);
  return <section className="live-timeline" aria-label="Research-to-answer timeline">
    <h3>Research → answer → evidence</h3>
    <p className="timeline-note">Recorded steps. A pending or unsure reply never resolves a missing feature.</p>
    <ol>{events.map((event) => <li key={event.id} data-state={event.state} aria-label={event.label}>
      <span className="timeline-dot" aria-hidden="true">{event.state === "done" ? "✓" : event.state === "failed" ? "!" : "·"}</span>
      <div><strong><span className="timeline-full">{event.label}</span><span className="timeline-compact" aria-hidden="true">{event.id.startsWith("research:") ? "Sources checked" : event.id.startsWith("review:") ? "Question reviewed" : event.id.startsWith("send:") ? event.state === "done" ? "Question delivered" : event.label : event.id.startsWith("table:") ? event.state === "unresolved" ? "Conflict retained" : "Cell updated" : event.state === "done" ? "Reply received" : event.label}</span></strong><time dateTime={event.at}>{event.at.slice(11, 19)} UTC</time><details><summary>Details</summary><p>{event.detail}</p></details></div>
    </li>)}</ol>
  </section>;
}
