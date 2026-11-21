"use client";
import LiveTimeline from "./live-timeline";
import ResearchBriefView from "./research-brief";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { evidenceStatus, requirements, statusLabels } from "@/lib/evidence";
import {
  questionFor,
  evidenceUpdates,
  updateAnnouncement,
  type RoomAccess,
  type RoomMessage,
  type RoomSnapshot,
} from "@/lib/confirmation";

export default function ConfirmationRoom({
  access,
  onSnapshot,
}: {
  access: RoomAccess;
  onSnapshot?: (snapshot: RoomSnapshot) => void;
}) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState("Opening room…");
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [answer, setAnswer] = useState<"available" | "unavailable" | "unsure">(
    "unsure",
  );
  const [feature, setFeature] = useState("restroom");
  const [report, setReport] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [changedFeature, setChangedFeature] = useState("");
  const [notice, setNotice] = useState("");
  const callback = useRef(onSnapshot);
  const latest = useRef<RoomSnapshot | null>(null);
  const pendingId = useRef<string | null>(null);
  const alive = useRef(true);
  const transcript = useRef<HTMLDivElement>(null);
  callback.current = onSnapshot;
  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${access.key}`,
      "Content-Type": "application/json",
    }),
    [access.key],
  );
  const accept = useCallback((next: RoomSnapshot) => {
    if (!alive.current) return;
    const before = latest.current;
    if (before) {
      // A delayed read must not roll back a newer message or its delivery acknowledgement.
      if (
        next.messages.length < before.messages.length ||
        before.messages.some(
          (old) =>
            old.delivery === "delivered" &&
            !next.messages.some(
              (message) =>
                message.id === old.id && message.delivery === "delivered",
            ),
        )
      )
        return;
      const last = evidenceUpdates(before, next).at(-1);
      if (last) {
        setChangedFeature(last.requirement);
        setNotice(updateAnnouncement(last));
      }
    } else {
      setFeature(next.requirement);
      if (next.datasetMode === "demo" && next.role === "representative") {
        setAuthor("Asha · demo venue team");
      }
    }
    latest.current = next;
    setSnapshot(next);
    callback.current?.(next);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/${access.id}`, {
        headers: headers(),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load room.");
      accept(data);
      setError("");
      return data as RoomSnapshot;
    } catch (err) {
      if (alive.current)
        setError(
          err instanceof Error ? err.message : "Room connection failed.",
        );
    }
  }, [access.id, headers, accept]);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    const focus = () => {
      void refresh();
    };
    async function start() {
      const room = await refresh();
      if (!room || cancelled) return;
      if (room.mode === "rehearsal") {
        setStatus("Local rehearsal · 1-second sync");
        poll = setInterval(() => {
          void refresh();
        }, 1000);
        return;
      }
      setStatus("Connecting to Nexconn…");
      try {
        const response = await fetch(`/api/rooms/${access.id}/token`, {
          method: "POST",
          headers: headers(),
        });
        const config = await response.json();
        if (!response.ok)
          throw new Error(config.error ?? "Could not connect to Nexconn.");
        if (cancelled) return;
        const { subscribeNexconn } = await import("@/lib/nexconn-client");
        if (cancelled) return;
        const unsubscribe = await subscribeNexconn(
          config,
          () => {
            if (!cancelled) void refresh();
          },
          (value) => {
            if (!cancelled) setStatus(value);
          },
        );
        if (cancelled) unsubscribe();
        else cleanup = unsubscribe;
      } catch (err) {
        if (!cancelled) {
          setStatus("Nexconn disconnected");
          setError(
            err instanceof Error ? err.message : "Nexconn connection failed.",
          );
        }
      }
    }
    void start();
    window.addEventListener("focus", focus);
    return () => {
      cancelled = true;
      alive.current = false;
      cleanup?.();
      if (poll) clearInterval(poll);
      window.removeEventListener("focus", focus);
    };
  }, [access.id, headers, refresh]);
  useEffect(() => {
    transcript.current?.scrollTo({
      top: transcript.current.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [snapshot?.messages.length]);
  useEffect(() => {
    if (!changedFeature) return;
    const timer = setTimeout(() => setChangedFeature(""), 10000);
    return () => clearTimeout(timer);
  }, [changedFeature, notice]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!snapshot) return;
    setSending(true);
    setError("");
    pendingId.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/rooms/${access.id}/messages`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          id: pendingId.current,
          author: author.trim(),
          text: text.trim(),
          ...(snapshot.role === "representative" && report
            ? { requirement: feature, answer }
            : {}),
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not send message.");
      accept(data.snapshot);
      if (data.deliveryFailed) {
        setError(
          "Saved, but Nexconn did not acknowledge delivery. Use Retry delivery in the transcript; the table will update after successful delivery.",
        );
      }
      if (!data.deliveryFailed) {
        setText("");
        pendingId.current = null;
      }
    } catch (err) {
      setError(
        `${err instanceof Error ? err.message : "Could not send message."} Your text is still here. Retry when connected.`,
      );
    } finally {
      setSending(false);
    }
  }
  async function retry(message: RoomMessage) {
    setSending(true);
    try {
      const response = await fetch(`/api/rooms/${access.id}/messages`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(message),
      });
      const data = await response.json();
      if (!response.ok || data.deliveryFailed)
        throw new Error(
          "Nexconn delivery is still unavailable. Try again after reconnecting.",
        );
      accept(data.snapshot);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setSending(false);
    }
  }
  async function copyInvite() {
    const key = access.representativeKey;
    if (!key) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/rooms/${access.id}#key=${key}`,
      );
      setCopied(true);
    } catch {
      setError("Clipboard unavailable. Use Open representative view below.");
    }
  }
  if (!snapshot)
    return (
      <section className="confirmation-room">
        <p role="status">{status}</p>
        {error && <p role="alert">{error}</p>}
        <button onClick={() => void refresh()}>Retry opening room</button>
      </section>
    );
  return (
    <section
      className="confirmation-room"
      aria-labelledby={`room-title-${access.id}`}
    >
      <div className="room-heading">
        <div>
          <span className="eyebrow light">FROM UNKNOWN TO ANSWERED</span>
          <h2 id={`room-title-${access.id}`}>
            <MessageCircle size={23} />
            Venue confirmation room
          </h2>
          <p>{snapshot.venue.name}</p>
        </div>
        <span className={`transport-badge ${snapshot.mode}`}>{status}</span>
      </div>
      {snapshot.mode === "rehearsal" && (
        <div className="rehearsal-banner">
          <TriangleAlert size={18} />
          Local rehearsal. Messages sync through this server; Nexconn is not
          being used.
        </div>
      )}
      {snapshot.role === "visitor" && <LiveTimeline snapshot={snapshot} />}
      {snapshot.research && <details className="room-research"><summary>Inspect saved research brief & citations</summary><ResearchBriefView run={snapshot.research} /></details>}
      <div className="room-identity">
        <ShieldCheck size={18} />
        <span>
          You’re the{" "}
          <strong>
            {snapshot.role === "representative"
              ? "invited representative"
              : "visitor"}
          </strong>
          .{" "}
          {snapshot.datasetMode === "demo"
            ? "Fictional venue for demonstration."
            : "Representative identity and venue ownership are not verified."}
        </span>
      </div>
      {access.representativeKey && (
        <div className="invite-bar">
          <div>
            <strong>Invite someone to answer</strong>
            <p>
              Open the representative view in another tab or share its private
              link. It permits submitting reports for this room.
            </p>
          </div>
          <button onClick={() => void copyInvite()}>
            <Copy size={16} />
            {copied ? "Link copied" : "Copy invite"}
          </button>
          <a
            href={`/rooms/${access.id}#key=${access.representativeKey}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open representative view <ExternalLink size={15} />
          </a>
          <a href="/demo">Open side-by-side demo</a>
        </div>
      )}
      <div className="room-checks">
        {requirements.map((req) => {
          const evidence = snapshot.venue.evidence[req.id];
          const state = evidenceStatus(evidence);
          const initial = evidence.filter((e) => e.roomId !== snapshot.id);
          const before = evidenceStatus(initial);
          return (
            <article
              className={`room-check ${changedFeature === req.id ? "just-updated" : ""}`}
              key={req.id}
            >
              <span>{req.short}</span>
              <strong>{statusLabels[state]}</strong>
              <small>
                {before !== state
                  ? `Previously ${statusLabels[before].toLowerCase()}`
                  : `${evidence.length} ${evidence.length === 1 ? "report" : "reports"}`}
              </small>
              {evidence.some((e) => e.kind === "representative") && (
                <span className="rep-report-label">
                  <Check size={13} />
                  Representative report added
                </span>
              )}
            </article>
          );
        })}
      </div>
      {notice && (
        <div className="live-update" role="status" aria-live="polite">
          <Check size={18} />
          {notice}
        </div>
      )}
      <div
        className="chat-transcript"
        ref={transcript}
        aria-label="Room conversation"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {snapshot.messages.map((message) => (
          <article
            id={`message-${message.id}`}
            className={`chat-message ${message.role}`}
            key={message.id}
          >
            <div className="chat-message-meta">
              <strong>{message.author}</strong>
              <span>
                {message.role === "representative"
                  ? "Invited representative"
                  : "Visitor"}{" "}
                ·{" "}
                <time dateTime={message.createdAt}>
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </span>
            </div>
            <p>{message.text}</p>
            {message.answer && (
              <span className="message-report">
                {requirements.find((r) => r.id === message.requirement)?.short}:{" "}
                {message.answer === "unsure"
                  ? "Still needs checking"
                  : message.answer === "available"
                    ? "Reported available"
                    : "Reported unavailable"}
              </span>
            )}
            <small>
              {message.delivery === "delivered"
                ? snapshot.mode === "nexconn"
                  ? "Delivered through Nexconn"
                  : "Saved in local rehearsal"
                : message.delivery === "pending"
                  ? "Delivery pending"
                  : "Delivery failed"}
            </small>
            {message.delivery === "failed" &&
              message.role === snapshot.role && (
                <button disabled={sending} onClick={() => void retry(message)}>
                  Retry delivery
                </button>
              )}
          </article>
        ))}
      </div>
      <form className="chat-composer" onSubmit={submit}>
        {snapshot.role === "representative" && (
          <p className="report-disclosure">
            Your answer appears as an invited representative report, not an
            independent accessibility inspection. “Unavailable” and “Unsure” are
            useful answers too.
          </p>
        )}
        {snapshot.role === "representative" &&
          snapshot.datasetMode === "demo" && (
            <button
              className="demo-reply-button"
              type="button"
              onClick={() => {
                setFeature("restroom");
                setReport(true);
                setAnswer("available");
                setText(
                  "Fictional demo: the toilet is on the ground floor, with a step-free route, grab rails, and wheelchair turning space. Doorway clearance and transfer-side measurements still need checking.",
                );
                pendingId.current = null;
              }}
            >
              Prepare the fictional demo reply
            </button>
          )}
        <fieldset className="composer-inputs" disabled={sending}>
          <div className="composer-top">
            <label>
              Your display name
              <input
                required
                minLength={2}
                maxLength={60}
                value={author}
                placeholder={
                  snapshot.role === "representative"
                    ? "e.g. Asha · venue team"
                    : "e.g. Sam"
                }
                onChange={(e) => {
                  setAuthor(e.target.value);
                  pendingId.current = null;
                }}
              />
            </label>
            {snapshot.role === "representative" && (
              <label className="report-toggle">
                <input
                  type="checkbox"
                  checked={report}
                  onChange={(e) => {
                    setReport(e.target.checked);
                    pendingId.current = null;
                  }}
                />
                Add a feature report
              </label>
            )}
          </div>
          {snapshot.role === "representative" && report && (
            <div className="report-fields">
              <label>
                Feature
                <select
                  value={feature}
                  onChange={(e) => {
                    setFeature(e.target.value);
                    pendingId.current = null;
                  }}
                >
                  {requirements.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Your answer
                <select
                  value={answer}
                  onChange={(e) => {
                    setAnswer(e.target.value as typeof answer);
                    pendingId.current = null;
                  }}
                >
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                  <option value="unsure">Unsure · I need to check</option>
                </select>
              </label>
            </div>
          )}
          <label>
            {snapshot.role === "representative" && report
              ? "Describe what a visitor can expect"
              : "Your message"}
            <textarea
              required
              minLength={3}
              maxLength={2000}
              rows={3}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                pendingId.current = null;
              }}
              placeholder={
                snapshot.role === "representative"
                  ? "Describe the route, steps, measurements, or facilities you can confirm. Avoid a blanket ‘accessible’ answer."
                  : questionFor(snapshot.requirement)
              }
            />
          </label>
        </fieldset>
        <div className="composer-actions">
          <span>Reports retain their author and timestamp.</span>
          <button
            className="primary-button"
            disabled={sending || !author.trim() || text.trim().length < 3}
            type="submit"
          >
            {sending ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Send size={17} />
            )}
            {sending
              ? "Sending…"
              : snapshot.role === "representative" && report
                ? "Send report & update table"
                : "Send message"}
          </button>
        </div>
      </form>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="room-footer">
        <span>
          Private invite · expires in 24 hours · records saved on this server
        </span>
        <button onClick={() => void refresh()}>
          <RefreshCw size={14} />
          Refresh room
        </button>
      </div>
    </section>
  );
}
