"use client";
import { useState } from "react";
import { demoSearch } from "@/lib/demo";
import { questionFor } from "@/lib/confirmation";

export default function DemoStarter({
  label = "Start the live evidence demo",
}: {
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    setBusy(true);
    setError("");
    try {
      const result = demoSearch();
      // A small, repeatable comparison. Fictional evidence, real Nexconn transport.
      result.venues = [result.venues[1], result.venues[0], result.venues[2]];
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue: result.venues[0],
          requirement: "restroom",
          datasetMode: "demo",
          mode: "nexconn",
          question: questionFor("restroom"),
        }),
        signal: AbortSignal.timeout(40000),
      });
      const access = await response.json();
      if (!response.ok)
        throw new Error(access.error ?? "The demo could not start.");
      sessionStorage.setItem(
        "ap-confirmation-session",
        JSON.stringify({ access, result }),
      );
      window.location.assign("/demo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      setBusy(false);
    }
  }
  return (
    <div className="demo-starter">
      <button
        className="primary-button"
        onClick={() => void start()}
        disabled={busy}
      >
        {busy ? "Connecting both views…" : label}
      </button>
      {error && (
        <p role="alert">
          {error} <a href="/login">Unlock hosted demo</a>
        </p>
      )}
    </div>
  );
}
