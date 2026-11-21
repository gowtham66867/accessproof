"use client";
import { useState, type FormEvent } from "react";
export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the demo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <form onSubmit={submit}>
        <span className="eyebrow light">ACCESSPROOF · BUILDATHON PREVIEW</span>
        <h1>Clear answers before you go.</h1>
        <p>
          Enter the shared demo passphrase to explore live venue search and
          confirmation rooms.
        </p>
        <label>
          Demo passphrase
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            maxLength={256}
          />
        </label>
        <button className="primary-button" disabled={busy}>
          {busy ? "Opening…" : "Open AccessProof"}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </div>
  );
}
