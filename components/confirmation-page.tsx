"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ConfirmationRoom from "./confirmation-room";

export default function ConfirmationPage({ id }: { id: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    setEmbedded(new URLSearchParams(window.location.search).has("embedded"));
    const value = new URLSearchParams(window.location.hash.slice(1)).get("key");
    if (value) {
      sessionStorage.setItem(`ap-room-${id}`, value);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
    setKey(value || sessionStorage.getItem(`ap-room-${id}`) || "");
  }, [id]);
  return (
    <div className={`room-page ${embedded ? "representative-embedded" : ""}`}>
      <header>
        <Link href="/">AccessProof</Link>
        <span>Clear answers before you go.</span>
      </header>
      {key === null ? (
        <p>Opening your private room…</p>
      ) : key ? (
        <ConfirmationRoom key={id} access={{ id, key }} />
      ) : (
        <section className="confirmation-room">
          <h1>This room needs its private invite link.</h1>
          <p>
            Ask the visitor to share the representative invite. Room IDs alone
            don’t grant access.
          </p>
          <Link href="/">Find a place</Link>
        </section>
      )}
    </div>
  );
}
