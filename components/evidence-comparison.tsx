"use client";
import {
  Bookmark,
  Check,
  CircleHelp,
  Minus,
  TriangleAlert,
} from "lucide-react";
import {
  evidenceStatus,
  requirements,
  statusLabels,
  type Requirement,
  type Venue,
} from "@/lib/evidence";
import type { EvidenceUpdate } from "@/lib/confirmation";

export default function EvidenceComparison({
  venues,
  selected,
  details,
  saved,
  onSave,
  onEvidence,
  update,
  focusRequirement,
}: {
  venues: Venue[];
  selected: Requirement[];
  details: Partial<Record<Requirement, string>>;
  saved: string[];
  onSave: (id: string) => void;
  onEvidence: (venue: Venue, requirement: Requirement) => void;
  update: EvidenceUpdate | null;
  focusRequirement?: Requirement;
}) {
  return (
    <div
      className="table-scroll comparison-scroll"
      tabIndex={0}
      role="region"
      aria-label="Accessibility comparison. Scroll horizontally to compare venues."
    >
      <table className="comparison-table">
        <caption className="sr-only">
          Venues in columns, requested features in rows. All reports are
          attributed claims.
        </caption>
        <thead>
          <tr>
            <th scope="col">
              For your visit<small>Compare one detail at a time</small>
            </th>
            {venues.map((venue) => (
              <th scope="col" key={venue.id}>
                <strong>{venue.name}</strong>
                <small>{venue.address}</small>
                <small>
                  {venue.rating ? `★ ${venue.rating.toFixed(1)} · ` : ""}
                  {venue.category}
                </small>
                {venue.mapsUrl && (
                  <a
                    href={venue.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open map listing
                  </a>
                )}
                {venue.warning && (
                  <small>Some listing details could not be retrieved.</small>
                )}
                <button
                  className={`shortlist-action ${saved.includes(venue.id) ? "saved" : ""}`}
                  onClick={() => onSave(venue.id)}
                  aria-pressed={saved.includes(venue.id)}
                  aria-label={`${saved.includes(venue.id) ? "Remove" : "Save"} ${venue.name}`}
                >
                  <Bookmark size={15} />
                  {saved.includes(venue.id) ? "Shortlisted" : "Shortlist"}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requirements
            .filter((r) => selected.includes(r.id))
            .sort(
              (a, b) =>
                Number(b.id === focusRequirement) -
                Number(a.id === focusRequirement),
            )
            .map((req) => (
              <tr key={req.id}>
                <th scope="row">
                  <strong>{req.short}</strong>
                  <small>{req.label}</small>
                  {details[req.id] && (
                    <p className="specific-need">
                      Your detail: {details[req.id]}
                      <small>
                        Specific fit needs confirmation; a general feature
                        report does not establish it.
                      </small>
                    </p>
                  )}
                </th>
                {venues.map((venue) => {
                  const evidence = venue.evidence[req.id];
                  const status = evidenceStatus(evidence);
                  const report = evidence.at(-1);
                  const changed =
                    update?.venueId === venue.id &&
                    update.requirement === req.id;
                  const Icon =
                    status === "supported"
                      ? Check
                      : status === "unsupported"
                        ? Minus
                        : status === "conflicting"
                          ? TriangleAlert
                          : CircleHelp;
                  return (
                    <td
                      key={venue.id}
                      className={changed ? "evidence-changed" : ""}
                      data-venue={venue.id}
                      data-feature={req.id}
                    >
                      <button
                        className={`status-button ${status}`}
                        onClick={() => onEvidence(venue, req.id)}
                        aria-label={`${venue.name}: ${req.short}, ${statusLabels[status]}. ${report ? "View evidence" : "Ask the venue"}.`}
                      >
                        <span>
                          <Icon size={16} aria-hidden="true" />
                          {statusLabels[status]}
                        </span>
                        {changed && (
                          <small className="previous-status">
                            Previously: {statusLabels[update.before]}
                          </small>
                        )}
                        <small className="cell-excerpt">
                          {report?.excerpt ??
                            `No ${req.short.toLowerCase()} details found.`}
                        </small>
                        {report && (
                          <>
                            <small>
                              {report.kind === "representative"
                                ? `Invited representative · ${report.author}`
                                : report.source}
                            </small>
                            <small>
                              {report.publishedAt ? "Reported" : "Retrieved"}{" "}
                              {new Date(
                                report.publishedAt ?? report.retrievedAt,
                              )
                                .toISOString()
                                .slice(0, 16)
                                .replace("T", " ")}{" "}
                              UTC
                            </small>
                          </>
                        )}
                        <small className="cell-action">
                          {report
                            ? `Inspect ${evidence.length} ${evidence.length === 1 ? "report" : "reports"}`
                            : "Ask the venue"}
                        </small>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
