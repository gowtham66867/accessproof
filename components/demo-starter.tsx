"use client";
import { useEffect, useRef, useState } from "react";
import { demoSearch } from "@/lib/demo";
import type { SearchResult } from "@/lib/evidence";
import type { AgentResearch } from "@/lib/agent";
import ResearchBriefView from "./research-brief";

export default function DemoStarter({ label = "Start the live evidence demo" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [research, setResearch] = useState<(AgentResearch & { receipt: string }) | null>(null);
  const [question, setQuestion] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const preparedResult = useRef<SearchResult | null>(null);
  useEffect(() => { if (research && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [research]);
  async function prepare() {
    setBusy(true); setError("");
    try {
      const result = demoSearch();
      result.venues = [result.venues[1], result.venues[0], result.venues[2]];
      preparedResult.current = result;
      const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ venue: result.venues[0], requirement: "restroom", mode: "demo" }), signal: AbortSignal.timeout(35000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Research could not start.");
      setQuestion(data.draftQuestion); setResearch(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function start() {
    if (!research) return;
    setBusy(true); setError("");
    try {
      const result = preparedResult.current;
      if (!result) throw new Error("Prepare the brief again before opening the room.");
      const response = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ venue: result.venues[0], requirement: "restroom", datasetMode: "demo", mode: "nexconn", question, researchReceipt: research.receipt }), signal: AbortSignal.timeout(40000) });
      const access = await response.json();
      if (!response.ok) throw new Error(access.error ?? "The demo could not start.");
      sessionStorage.setItem("ap-confirmation-session", JSON.stringify({ access, result }));
      window.location.assign("/demo");
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); setBusy(false); }
  }
  return <div className="demo-starter">
    <button className="primary-button" onClick={() => void prepare()} disabled={busy}>{busy ? "Preparing your demo…" : label}</button>
    {research && <dialog className="demo-review" ref={dialog} onCancel={() => { if (!busy) setResearch(null); }} aria-labelledby="demo-review-title">
      <h2 id="demo-review-title">Review the gap. Then watch the answer arrive.</h2>
      <p>Juniper is fictional. These research clues are fixtures; the Nexconn delivery will be real.</p>
      <ResearchBriefView run={research} />
      <label>Review your question<textarea aria-label="Review your demo question" value={question} onChange={e => setQuestion(e.target.value)} minLength={10} maxLength={1500} /></label>
      <div className="demo-review-actions"><button className="primary-button" disabled={busy || question.trim().length < 10} onClick={() => void start()}>{busy ? "Connecting both views…" : "Approve question & open live demo"}</button><button className="text-button" disabled={busy} onClick={() => setResearch(null)}>Cancel</button></div>
      {error && <p role="alert">{error}</p>}
    </dialog>}
    {error && !research && <p role="alert">{error} <a href="/login">Unlock hosted demo</a></p>}
  </div>;
}
