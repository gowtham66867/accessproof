"use client";
import ResearchAgent from "./research-agent";
import { useState } from "react";
import { LoaderCircle, MessageCircle } from "lucide-react";
import type { Requirement, Venue } from "@/lib/evidence";
import { questionFor } from "@/lib/confirmation";
import type { RoomAccess } from "@/lib/confirmation";

export default function ConfirmationLauncher({
  venue,
  requirement,
  datasetMode,
  onOpen,
  detail = "",
}: {
  detail?: string;
  venue: Venue;
  requirement: Requirement;
  datasetMode: "demo" | "live";
  onOpen: (access: RoomAccess) => void;
}) {
  const [question, setQuestion] = useState(
    questionFor(requirement) +
      (detail ? `\nPlease also confirm: ${detail}` : ""),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create(mode: "nexconn" | "rehearsal") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue,
          requirement,
          datasetMode,
          mode,
          question,
        }),
        signal: AbortSignal.timeout(40000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create room.");
      sessionStorage.setItem(`ap-room-${data.id}`, data.key);
      onOpen(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Room creation failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="confirmation-launcher">
      <h3>Ask someone who’s there.</h3>
      <p>
        Create a private room and invite a representative to answer this
        question. Their attributed report updates the table when delivered.
      </p>
      <ResearchAgent
        venue={venue}
        requirement={requirement}
        mode={datasetMode}
        hasDetail={Boolean(detail.trim())}
        onUseDraft={(result) =>
          setQuestion(
            (
              result.draftQuestion +
              (detail ? `\nPlease also confirm: ${detail}` : "")
            ).slice(0, 1500),
          )
        }
      />
      <label className="question-editor">
        Your question
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          minLength={10}
          maxLength={1500}
          rows={4}
        />
      </label>
      <p>
        Only this question and the venue details are sent. Invite the venue team
        using the private link; AccessProof does not automatically contact the
        business.
      </p>
      <button
        className="primary-button"
        disabled={busy || question.trim().length < 10}
        onClick={() => void create("nexconn")}
      >
        {busy ? (
          <LoaderCircle className="spin" size={18} />
        ) : (
          <MessageCircle size={18} />
        )}
        Ask the venue · Nexconn
      </button>
      {process.env.NODE_ENV !== "production" && (
        <button
          className="rehearsal-button"
          disabled={busy || question.trim().length < 10}
          onClick={() => void create("rehearsal")}
        >
          Start local rehearsal
        </button>
      )}
      {error && (
        <p role="alert" className="launch-error">
          {error}
        </p>
      )}
      <small>
        The invite grants the representative role for this room. It does not
        verify venue ownership.
      </small>
    </div>
  );
}
