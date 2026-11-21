import type { AgentResearch } from "@/lib/agent";
export default function ResearchBriefView({ run }: { run: AgentResearch }) {
  return <section className="cited-brief" aria-label="Cited research brief">
    <header><span className="eyebrow">RESEARCH, WITH THE GAPS ATTACHED</span><h3>Cited research brief</h3></header>
    <p>{run.brief.summary}</p>
    {run.mode === "demo" && <p className="brief-fixture">Fictional source fixtures · zero Tavily calls</p>}
    {run.brief.reported.length > 0 && <details><summary>What existing reports say</summary><ul>{run.brief.reported.map((r, i) => <li key={i}><strong>{r.feature}:</strong> “{r.text}” <small>{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.source}</a> : r.source}</small></li>)}</ul></details>}
    <h4>What source excerpts say</h4>
    {run.brief.findings.length ? <ol className="brief-findings">{run.brief.findings.map((f) => {
      const source = run.clues[f.citation - 1];
      return <li key={f.citation}><blockquote>“{f.text}”</blockquote><a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`Citation ${f.citation}: ${source.title}`}>[{f.citation}] {source.title}</a><small>{source.domain} · retrieved {source.retrievedAt.slice(0, 19).replace("T", " ")} UTC</small></li>;
    })}</ol> : <p>No source findings to cite. An empty search is not evidence of availability or unavailability.</p>}
    <div className="brief-open"><h4>Still needs an answer</h4><ul>{run.brief.unanswered.map(q => <li key={q}>{q}</li>)}</ul></div>
    <p className="brief-disagreement"><strong>Disagreement check:</strong> {run.brief.disagreement}</p>
    <small>Extractive source clues, not an inspection. Retrieval time is not the date a facility was checked.</small>
  </section>;
}
