"use client";
import { useState } from "react";
import { Search, LoaderCircle } from "lucide-react";
import type { Requirement, Venue } from "@/lib/evidence";
import type { AgentResearch } from "@/lib/agent";
export default function ResearchAgent({
  venue,
  requirement,
  mode,
  hasDetail,
  onUseDraft,
}: {
  venue: Venue;
  requirement: Requirement;
  mode: "demo" | "live";
  hasDetail: boolean;
  onUseDraft: (result: AgentResearch) => void;
}) {
  const [result, setResult] = useState<AgentResearch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue,
          requirement,
          mode,
          needsDetails: hasDetail,
        }),
        signal: AbortSignal.timeout(35000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Agent research failed.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="research-agent" aria-labelledby="agent-title">
      <h3 id="agent-title">Let the research agent check first</h3>
      <p>
        It inspects the gap, chooses source checks, replans if sources are
        limited, then drafts a question for you. Research clues never change the
        table on their own.
      </p>
      <p className="agent-policy">
        Bounded tool-using policy agent · no LLM planner ·{" "}
        {mode === "demo"
          ? "fictional research fixtures, zero search credits"
          : "at most 2 Tavily searches; recent runs reused"}
      </p>
      <button
        type="button"
        className="agent-run"
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? (
          <LoaderCircle size={17} className="spin" />
        ) : (
          <Search size={17} />
        )}{" "}
        {busy ? "Agent checking sources…" : "Run research agent"}
      </button>
      <p className="agent-privacy">
        Only venue and feature terms go to search. Your written visit details
        stay in the question draft.
      </p>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div className="agent-result">
          <p role="status">
            {result.mode === "demo"
              ? "Illustrative research run"
              : "Live Tavily research run"}{" "}
            · {result.callsUsed}/{result.maxCalls}{" "}
            {result.mode === "demo"
              ? "illustrative calls · zero provider credits"
              : result.reused
                ? "prior calls · cached run reused"
                : "search calls"}{" "}
            · table unchanged
          </p>
          <ol aria-label="Agent action trace">
            {result.trace.map((step, i) => (
              <li key={i}>
                <strong>{step.action}</strong>
                <p>{step.observation}</p>
              </li>
            ))}
          </ol>
          {result.clues.length > 0 && (
            <div>
              <h4>Research clues to inspect</h4>
              {result.clues.map((clue) => (
                <article key={clue.url}>
                  <a href={clue.url} target="_blank" rel="noopener noreferrer">
                    {clue.title}
                  </a>
                  <p>{clue.excerpt}</p>
                  <small>
                    {clue.domain} · retrieved{" "}
                    {clue.retrievedAt.slice(0, 16).replace("T", " ")} UTC
                  </small>
                </article>
              ))}
            </div>
          )}
          <p>{result.stoppingReason}</p>
          <button
            type="button"
            className="agent-run"
            onClick={() => onUseDraft(result)}
          >
            Use agent draft for my question
          </button>
        </div>
      )}
    </section>
  );
}
