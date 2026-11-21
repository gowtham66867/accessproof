"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import EvidenceComparison from "./evidence-comparison";
import DemoStarter from "./demo-starter";
import {
  evidenceUpdates,
  updateAnnouncement,
  type EvidenceUpdate,
} from "@/lib/confirmation";
import { visitSummary } from "@/lib/visit-summary";
import ConfirmationLauncher from "./confirmation-launcher";
import ConfirmationRoom from "./confirmation-room";
import type { RoomAccess, RoomSnapshot } from "@/lib/confirmation";
import {
  Accessibility,
  Search,
  MapPin,
  Check,
  Minus,
  CircleHelp,
  TriangleAlert,
  ExternalLink,
  X,
  SlidersHorizontal,
  Coffee,
  ShieldCheck,
  BookOpen,
  LoaderCircle,
  Bookmark,
  CheckCheck,
} from "lucide-react";
import {
  evidenceStatus,
  requirements,
  statusLabels,
  supportedCount,
  type Requirement,
  type SearchResult,
  type Status,
  type Venue,
} from "@/lib/evidence";

function StatusIcon({ status }: { status: Status }) {
  const Icon =
    status === "supported"
      ? Check
      : status === "unsupported"
        ? Minus
        : status === "conflicting"
          ? TriangleAlert
          : CircleHelp;
  return <Icon size={15} aria-hidden="true" />;
}
export default function AccessProof({ initial }: { initial: SearchResult }) {
  const [result, setResult] = useState(initial);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [location, setLocation] = useState(initial.location);
  const [query, setQuery] = useState("cafés");
  const [selected, setSelected] = useState<Requirement[]>([
    "entrance",
    "seating",
    "restroom",
  ]);
  const [details, setDetails] = useState<Partial<Record<Requirement, string>>>(
    {},
  );
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [update, setUpdate] = useState<EvidenceUpdate | null>(null);
  const priorSnapshot = useRef<RoomSnapshot | null>(null);
  const [roomVenueId, setRoomVenueId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [onlySupported, setOnlySupported] = useState(false);
  const [sort, setSort] = useState("evidence");
  const [saved, setSaved] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [roomAccess, setRoomAccess] = useState<RoomAccess | null>(null);
  const [embedded, setEmbedded] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  useEffect(() => {
    const isEmbedded =
      new URLSearchParams(window.location.search).get("embedded") === "visitor";
    setEmbedded(isEmbedded);
    try {
      const preferences = JSON.parse(
        sessionStorage.getItem("ap-visit-preferences") || "null",
      );
      if (preferences && !isEmbedded) {
        const valid = preferences.selected?.filter((id: Requirement) =>
          requirements.some((r) => r.id === id),
        );
        if (valid?.length) setSelected(valid);
        if (preferences.details) setDetails(preferences.details);
        if (Array.isArray(preferences.saved)) setSaved(preferences.saved);
      }
    } catch {
      /* Invalid local preferences can be reset. */
    }
    setPreferencesReady(true);
    try {
      const stored = sessionStorage.getItem("ap-confirmation-session");
      if (!stored) return;
      const session = JSON.parse(stored) as {
        access: RoomAccess;
        result: SearchResult;
      };
      if (
        !session.access?.id ||
        !session.access.key ||
        !Array.isArray(session.result?.venues)
      )
        return;
      setResult(session.result);
      setMode(session.result.mode);
      setLocation(session.result.location);
      setQuery(session.result.query);
      setRoomAccess(session.access);
    } catch {
      sessionStorage.removeItem("ap-confirmation-session");
    }
  }, []);
  useEffect(() => {
    if (preferencesReady && !embedded)
      sessionStorage.setItem(
        "ap-visit-preferences",
        JSON.stringify({ selected, details, saved }),
      );
  }, [selected, details, saved, preferencesReady, embedded]);
  const acceptRoomSnapshot = useCallback((snapshot: RoomSnapshot) => {
    const before = priorSnapshot.current;
    if (before?.id === snapshot.id) {
      const change = evidenceUpdates(before, snapshot).at(-1);
      if (change) setUpdate(change);
    }
    priorSnapshot.current = snapshot;
    setRoomVenueId(snapshot.venue.id);
    setResult((current) => ({
      ...current,
      venues: current.venues.map((venue) =>
        venue.id === snapshot.venue.id ? snapshot.venue : venue,
      ),
    }));
    setActive((current) =>
      current?.venue.id === snapshot.venue.id
        ? { ...current, venue: snapshot.venue }
        : current,
    );
  }, []);
  const [active, setActive] = useState<{
    venue: Venue;
    requirement: Requirement;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const helpDialog = useRef<HTMLDialogElement>(null);
  const visible = useMemo(
    () =>
      result.venues
        .filter(
          (v) =>
            (!onlySupported ||
              supportedCount(v, selected) === selected.length) &&
            (!savedOnly || saved.includes(v.id)),
        )
        .sort((a, b) =>
          embedded && (a.id === roomVenueId || b.id === roomVenueId)
            ? Number(b.id === roomVenueId) - Number(a.id === roomVenueId)
            : sort === "rating"
              ? (b.rating ?? 0) - (a.rating ?? 0)
              : supportedCount(b, selected) - supportedCount(a, selected),
        ),
    [
      result,
      selected,
      onlySupported,
      sort,
      savedOnly,
      saved,
      embedded,
      roomVenueId,
    ],
  );
  const allReported = result.venues.filter(
    (v) => supportedCount(v, selected) === selected.length,
  ).length;
  const unknown = result.venues.reduce(
    (count, v) =>
      count + selected.filter((id) => !v.evidence[id].length).length,
    0,
  );

  async function search(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/venues?${new URLSearchParams({ mode, location, q: query })}`,
        { signal: AbortSignal.timeout(40000) },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Search could not complete.");
      setResult(data);
      setRoomAccess(null);
      setUpdate(null);
      priorSnapshot.current = null;
      sessionStorage.removeItem("ap-confirmation-session");
      setSaved([]);
    } catch (err) {
      setError(
        err instanceof Error && err.name === "TimeoutError"
          ? "The search timed out. Please try again."
          : err instanceof Error
            ? err.message
            : "Search could not complete.",
      );
    } finally {
      setLoading(false);
    }
  }
  function openEvidence(venue: Venue, requirement: Requirement) {
    setActive({ venue, requirement });
    dialog.current?.showModal();
  }
  function toggleRequirement(id: Requirement) {
    setSelected((current) =>
      current.includes(id)
        ? current.length > 1
          ? current.filter((value) => value !== id)
          : current
        : [...current, id],
    );
  }

  return (
    <div
      className={`app-shell ${embedded ? "demo-embedded" : ""} ${showConversation ? "show-conversation" : ""}`}
    >
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="AccessProof home">
          <span className="brand-icon">
            <Accessibility size={25} />
          </span>
          Access<span>Proof</span>
        </a>
        <div className="workspace-label">YOUR NEXT OUTING</div>
        <nav aria-label="Main navigation">
          <button
            className={!savedOnly ? "nav-item active" : "nav-item"}
            onClick={() => setSavedOnly(false)}
          >
            <Search size={18} />
            Find a place
          </button>
          <button
            className={savedOnly ? "nav-item active" : "nav-item"}
            onClick={() => setSavedOnly(true)}
          >
            <Bookmark size={18} />
            Session shortlist<span className="nav-count">{saved.length}</span>
          </button>
          <button
            className="nav-item"
            onClick={() => helpDialog.current?.showModal()}
          >
            <BookOpen size={18} />
            How evidence works
          </button>
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={24} />
          <strong>Your needs. Clearer answers.</strong>
          <p>
            See what’s reported, what’s missing, and what to ask before you go.
          </p>
        </div>
        <div className="sidebar-footer">
          BEYOND 9TO5 BUILDATHON<span>AccessProof · MVP</span>
        </div>
      </aside>

      <main id="main">
        <header className="topbar">
          <span>
            <MapPin size={15} />
            Find your next good place
          </span>
          <button
            className="text-button"
            onClick={() => helpDialog.current?.showModal()}
          >
            <CircleHelp size={16} />
            About the evidence
          </button>
        </header>
        <div className="content">
          <section className="hero">
            <div className="eyebrow">
              <span />
              LESS GUESSWORK. MORE GOING OUT.
            </div>
            <h1>
              A place for you.
              <br />
              <span>Evidence you can see.</span>
            </h1>
            <p>
              Find a place that fits your needs. See the evidence. Ask what’s
              missing.
              <br className="desktop-break" /> Every report has a source. Every
              unknown stays visible.
            </p>
            <div className="hero-symbol" aria-hidden="true">
              <Accessibility />
              <span className="symbol-check">
                <Check />
              </span>
            </div>
          </section>

          <section className="demo-invitation">
            <div>
              <strong>One answer can change the plan.</strong>
              <p>
                See a missing toilet report become attributed evidence in two
                live views. Fictional venues · real Nexconn connection.
              </p>
            </div>
            <DemoStarter />
          </section>
          <section className="search-panel" aria-labelledby="search-title">
            <div className="panel-heading">
              <h2 id="search-title">Where would you like to go?</h2>
              <div className="mode-switch" aria-label="Search data source">
                {(["demo", "live"] as const).map((m) => (
                  <button
                    key={m}
                    aria-pressed={mode === m}
                    className={mode === m ? "selected" : ""}
                    onClick={() => {
                      setMode(m);
                      setError("");
                      if (m === "demo") {
                        setLocation("Indiranagar, Bengaluru");
                        setQuery("cafés");
                      }
                    }}
                  >
                    {m === "demo" ? "Demo data" : "Live search"}
                  </button>
                ))}
              </div>
            </div>
            <form onSubmit={search}>
              <div className="search-fields">
                <label className="field">
                  <span>VENUE TYPE</span>
                  <div>
                    <Coffee size={19} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Cafés, restaurants…"
                      required
                      maxLength={100}
                      disabled={mode === "demo"}
                    />
                  </div>
                </label>
                <label className="field location-field">
                  <span>NEIGHBORHOOD OR CITY</span>
                  <div>
                    <MapPin size={19} />
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Indiranagar, Bengaluru"
                      required
                      maxLength={160}
                      disabled={mode === "demo"}
                    />
                  </div>
                </label>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <Search size={18} />
                  )}
                  {loading ? "Finding places…" : "Find places"}
                </button>
              </div>
              <fieldset className="requirements">
                <legend>
                  What matters for this visit?{" "}
                  <span>
                    Optional preferences · select at least one feature to
                    compare
                  </span>
                </legend>
                {requirements.map((req) => (
                  <label
                    className={
                      selected.includes(req.id)
                        ? "requirement selected"
                        : "requirement"
                    }
                    key={req.id}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(req.id)}
                      disabled={
                        selected.length === 1 && selected.includes(req.id)
                      }
                      onChange={() => toggleRequirement(req.id)}
                    />
                    <span>{req.label}</span>
                  </label>
                ))}
              </fieldset>
              <details className="visit-details">
                <summary>Add specific details for this visit</summary>
                <p>
                  For example: doorway clearance, a lift, or toilet transfer
                  space. General listing attributes do not establish these
                  details. You can review and edit a question before sharing
                  anything.
                </p>
                {requirements
                  .filter((r) => selected.includes(r.id))
                  .map((req) => (
                    <label key={req.id}>
                      {req.short}: what would you like confirmed?
                      <input
                        value={details[req.id] ?? ""}
                        maxLength={300}
                        placeholder={
                          req.id === "entrance"
                            ? "e.g. doorway clear width at least 85 cm"
                            : req.id === "seating"
                              ? "e.g. step-free route to an indoor table"
                              : "e.g. transfer space on the right"
                        }
                        onChange={(e) =>
                          setDetails((d) => ({
                            ...d,
                            [req.id]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setSelected(["entrance", "seating", "restroom"]);
                    setDetails({});
                  }}
                >
                  Reset visit preferences
                </button>
              </details>
            </form>
            <p className="mode-note">
              {mode === "demo"
                ? "Explore a fixed Bengaluru example. All demo venues, ratings, and reports are fictional."
                : "Search real listings using SerpApi. Recent identical searches are reused for 10 minutes; a fresh search uses up to 6 requests. The demo allows 10 fresh searches per hour per running instance."}
            </p>
          </section>
          {error && (
            <div className="error-message" role="alert">
              <TriangleAlert size={19} />
              <span>{error} Existing results remain below.</span>
            </div>
          )}
          {roomAccess && (
            <div id="confirmation-room">
              {embedded && showConversation && (
                <button
                  className="text-button"
                  onClick={() => setShowConversation(false)}
                >
                  Hide conversation
                </button>
              )}
              <ConfirmationRoom
                key={roomAccess.id}
                access={roomAccess}
                onSnapshot={acceptRoomSnapshot}
              />
            </div>
          )}
          <div
            className="evidence-moment"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {update && (
              <>
                <span className="eyebrow light">
                  A CLEARER ANSWER FOR YOUR VISIT
                </span>
                <h2>
                  {requirements.find((r) => r.id === update.requirement)?.short}
                  : {statusLabels[update.before]}{" "}
                  <span aria-hidden="true">→</span>
                  <span className="sr-only"> changed to </span>{" "}
                  {statusLabels[update.after]}
                </h2>
                <p>
                  {update.venueName} · {update.author} ·{" "}
                  <time dateTime={update.createdAt}>
                    {new Date(update.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </p>
                <blockquote>“{update.text}”</blockquote>
                <p>
                  Invited representative report. Earlier evidence retained;
                  specific fit may still need confirmation.
                </p>
                <button
                  className="text-button"
                  onClick={() => {
                    const venue = result.venues.find(
                      (v) => v.id === update.venueId,
                    );
                    if (venue) openEvidence(venue, update.requirement);
                  }}
                >
                  Inspect this evidence
                </button>
                <a
                  href="#confirmation-room"
                  onClick={() => setShowConversation(true)}
                >
                  Read the conversation
                </a>
                <span className="sr-only">{updateAnnouncement(update)}</span>
              </>
            )}
          </div>
          {savedOnly && saved.length > 0 && (
            <section className="visit-summary">
              <h2>Your visit, with fewer unknowns.</h2>
              {result.venues
                .filter((v) => saved.includes(v.id))
                .map((v) => (
                  <p key={v.id}>
                    <strong>{v.name}</strong>: {supportedCount(v, selected)} of{" "}
                    {selected.length} selected features have supporting reports
                    without contradictions.
                    {selected.some((id) => details[id]) &&
                      " Your specific details still need confirmation."}
                  </p>
                ))}
              <button
                className="text-button"
                onClick={() => {
                  const blob = new Blob(
                    [
                      visitSummary(
                        result.venues.filter((v) => saved.includes(v.id)),
                        selected,
                        details,
                      ),
                    ],
                    { type: "text/plain;charset=utf-8" },
                  );
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "accessproof-visit-summary.txt";
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Download visit summary
              </button>
              <p>
                Includes feature evidence and sources. Private room links and
                conversation history are excluded.
              </p>
            </section>
          )}
          <div className="results-area" aria-busy={loading}>
            <div className="results-heading">
              <div>
                <div className="eyebrow light">YOUR ACCESSIBILITY CHECK</div>
                <h2>
                  {savedOnly
                    ? "Your session shortlist"
                    : "Compare your options"}
                </h2>
                <p>
                  {result.query} in {result.location}{" "}
                  <span className={`data-badge ${result.mode}`}>
                    {result.mode === "demo"
                      ? "FICTIONAL DEMO"
                      : "LIVE LISTINGS"}
                  </span>
                </p>
              </div>
              <label className="sort-label">
                <SlidersHorizontal size={16} />
                <span className="sr-only">Sort venues</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="evidence">Most requirements reported</option>
                  <option value="rating">Highest rating</option>
                </select>
              </label>
            </div>
            <div className="result-summary" role="status" aria-live="polite">
              <span>
                <strong>{result.venues.length}</strong> places found
              </span>
              <span>
                <CheckCheck size={17} />
                <strong>{allReported}</strong> with all selected features
                reported
              </span>
              <span>
                <CircleHelp size={17} />
                <strong>{unknown}</strong> unanswered checks
              </span>
            </div>
            <div className="table-panel">
              <div className="table-toolbar">
                <p>Click any status to inspect its evidence.</p>
                <label>
                  <input
                    type="checkbox"
                    checked={onlySupported}
                    onChange={(e) => setOnlySupported(e.target.checked)}
                  />
                  All selected features reported
                </label>
              </div>
              {visible.length ? (
                <EvidenceComparison
                  focusRequirement={embedded ? "restroom" : undefined}
                  venues={visible}
                  selected={selected}
                  details={details}
                  saved={saved}
                  update={update}
                  onEvidence={openEvidence}
                  onSave={(id) =>
                    setSaved((current) =>
                      current.includes(id)
                        ? current.filter((value) => value !== id)
                        : [...current, id],
                    )
                  }
                />
              ) : (
                <div className="empty-state">
                  <CircleHelp size={28} />
                  <h3>
                    {savedOnly
                      ? "Your shortlist is waiting."
                      : "No places match this view."}
                  </h3>
                  <p>
                    {result.venues.length
                      ? "Try removing a filter, or shortlist a venue from your search."
                      : "Try a nearby area or a broader venue type."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setOnlySupported(false);
                      setSavedOnly(false);
                    }}
                  >
                    Show all search results
                  </button>
                </div>
              )}
              <div className="table-footer">
                <span>
                  Showing {visible.length} of {result.venues.length} places
                </span>
                <span>Ratings do not indicate accessibility.</span>
              </div>
            </div>
            {result.warnings.map((w) => (
              <p className="warning-note" key={w}>
                <TriangleAlert size={17} />
                {w}
              </p>
            ))}
            <div className="evidence-note">
              <ShieldCheck size={22} />
              <div>
                <strong>Clear evidence. Honest unknowns.</strong>
                <p>
                  Reports describe individual features. “Unknown” means we don’t
                  have evidence. Check important details with the venue before
                  visiting.
                </p>
              </div>
              <button onClick={() => helpDialog.current?.showModal()}>
                Our approach
              </button>
            </div>
          </div>
          <footer className="page-footer">
            <span>Made for more inclusive everyday plans.</span>
            <span>AccessProof · Buildathon edition</span>
          </footer>
        </div>
      </main>
      <dialog
        ref={dialog}
        className="evidence-dialog"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
        aria-labelledby="evidence-title"
      >
        {active && (
          <>
            <div className="dialog-heading">
              <span className="eyebrow light">BEHIND THE REPORT</span>
              <button
                className="icon-button"
                onClick={() => dialog.current?.close()}
                aria-label="Close evidence"
              >
                <X />
              </button>
            </div>
            <h2 id="evidence-title">
              {requirements.find((r) => r.id === active.requirement)?.label}
            </h2>
            <p className="dialog-subtitle">{active.venue.name}</p>
            <div
              className={`evidence-status ${evidenceStatus(active.venue.evidence[active.requirement])}`}
            >
              <StatusIcon
                status={evidenceStatus(
                  active.venue.evidence[active.requirement],
                )}
              />
              {
                statusLabels[
                  evidenceStatus(active.venue.evidence[active.requirement])
                ]
              }
            </div>
            {result.mode === "demo" && (
              <p className="demo-callout">
                Fictional demo evidence. These reports do not describe a real
                venue.
              </p>
            )}
            {active.venue.evidence[active.requirement].length ? (
              active.venue.evidence[active.requirement].map((e, i) => (
                <article className="source-card" key={i}>
                  <span className="source-type">
                    {e.supports ? "SUPPORTING REPORT" : "REPORTS UNAVAILABLE"}
                  </span>
                  <blockquote>“{e.excerpt}”</blockquote>
                  <strong>{e.source}</strong>
                  {e.kind === "representative" && (
                    <p className="rep-attribution">
                      Invited representative report. Identity and venue
                      ownership are not independently verified.{" "}
                      {e.transport === "rehearsal"
                        ? "Recorded in local rehearsal."
                        : "Delivered through Nexconn."}
                    </p>
                  )}
                  <p>
                    {e.kind === "representative"
                      ? "Report made"
                      : "Source publication date"}
                    :{" "}
                    {e.publishedAt
                      ? new Date(e.publishedAt).toLocaleString()
                      : "not provided"}
                  </p>
                  <p>
                    Retrieved:{" "}
                    <time dateTime={e.retrievedAt}>
                      {new Date(e.retrievedAt).toUTCString()}
                    </time>
                  </p>
                  {e.roomId && (
                    <a
                      href="#confirmation-room"
                      onClick={() => {
                        setShowConversation(true);
                        dialog.current?.close();
                      }}
                    >
                      Read the conversation
                    </a>
                  )}
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noopener noreferrer">
                      Open listing <ExternalLink size={14} />
                    </a>
                  )}
                </article>
              ))
            ) : (
              <div className="unknown-card">
                <CircleHelp size={26} />
                <h3>This feature still needs a check.</h3>
                <p>
                  No explicit evidence was found in the retrieved listing. This
                  does not establish whether the feature is available.
                </p>
                <strong>Ask the venue</strong>
                <p>
                  {active.requirement === "entrance"
                    ? "Is there a wheelchair-accessible entrance? Are there any steps or narrow doorways along the way?"
                    : active.requirement === "seating"
                      ? "Can a wheelchair user reach and use the seating area? Which floor is it on, and is the route step-free?"
                      : "Is there a wheelchair-accessible toilet? Can it be reached without stairs, and does it have grab rails and turning space?"}
                </p>
              </div>
            )}
            {evidenceStatus(active.venue.evidence[active.requirement]) ===
              "conflicting" && (
              <p className="demo-callout">
                The reports disagree. Confirm the current situation with the
                venue before making plans.
              </p>
            )}
            <ConfirmationLauncher
              key={`${active.venue.id}-${active.requirement}`}
              detail={details[active.requirement]}
              venue={active.venue}
              requirement={active.requirement}
              datasetMode={result.mode}
              onOpen={(access) => {
                sessionStorage.setItem(
                  "ap-confirmation-session",
                  JSON.stringify({ access, result }),
                );
                setRoomAccess(access);
                dialog.current?.close();
                setTimeout(
                  () =>
                    document
                      .getElementById("confirmation-room")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  100,
                );
              }}
            />
            <p className="dialog-footnote">
              Listing attributes may be supplied by different contributors. They
              are not independently verified by AccessProof. Retrieval time is
              not the date a feature was checked.
            </p>
          </>
        )}
      </dialog>
      <dialog
        ref={helpDialog}
        className="evidence-dialog"
        onClick={(e) => {
          if (e.target === e.currentTarget) helpDialog.current?.close();
        }}
        aria-labelledby="help-title"
      >
        <div className="dialog-heading">
          <ShieldCheck size={25} />
          <button
            className="icon-button"
            onClick={() => helpDialog.current?.close()}
            aria-label="Close explanation"
          >
            <X />
          </button>
        </div>
        <h2 id="help-title">Evidence before assumptions.</h2>
        <p>
          AccessProof compares explicit reports for each feature you select. It
          never uses star ratings to infer accessibility.
        </p>
        {(Object.keys(statusLabels) as Status[]).map((s) => (
          <div className="help-row" key={s}>
            <span className={`evidence-status ${s}`}>
              <StatusIcon status={s} />
              {statusLabels[s]}
            </span>
            <p>
              {s === "supported"
                ? "At least one retrieved report lists the feature as available, with no contradictory report in our evidence."
                : s === "unsupported"
                  ? "A retrieved report explicitly lists the feature as unavailable."
                  : s === "conflicting"
                    ? "Retrieved reports disagree. Keep both and ask for confirmation."
                    : "No explicit report was found in the retrieved data."}
            </p>
          </div>
        ))}
        <p className="dialog-footnote">
          This version uses Google Maps listing attributes through SerpApi.
          Visitor reports in demo mode are fictional examples. Web evidence
          enrichment is planned next. Invited representatives can add dated
          feature reports through a private confirmation room; contradictory
          reports remain visible.
        </p>
      </dialog>
    </div>
  );
}
