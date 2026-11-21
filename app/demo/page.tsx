"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import DemoStarter from "@/components/demo-starter";
import type { RoomAccess } from "@/lib/confirmation";

export default function DemoPage() {
  const [access, setAccess] = useState<RoomAccess | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ap-confirmation-session");
      if (raw) setAccess(JSON.parse(raw).access);
    } catch {
      /* A fresh demo can be created from search. */
    }
    setReady(true);
  }, []);
  return (
    <div className="split-demo">
      <header>
        <Link href="/">AccessProof</Link>
        <span>One answer. Two views. Evidence updated live.</span>
        <div className="demo-header-actions">
          <DemoStarter label="Start a fresh demo" />
          <Link href="/">Back to search</Link>
        </div>
      </header>
      {!ready ? (
        <p>Opening your demo…</p>
      ) : !access?.representativeKey ? (
        <div className="split-empty">
          <h1>Start a confirmation room first.</h1>
          <p>
            Start a fictional café scenario with a real Nexconn connection.
            Prepare the representative reply, then send it to watch the
            visitor’s evidence update.
          </p>
          <DemoStarter />
          <Link href="/">Or find a venue</Link>
        </div>
      ) : (
        <>
          <div className="demo-story">
            <strong>A plan is waiting on one detail.</strong>
            <span>
              Juniper’s toilet information starts as Unknown. In the
              representative view, prepare the fictional reply and send it.
              Watch the visitor’s table update. This scenario uses fictional
              venues; the Nexconn delivery is live.
            </span>
          </div>
          <div className="split-panes">
            <section>
              <h2>
                Visitor <small>Watch the evidence change here</small>
              </h2>
              <iframe
                title="Visitor evidence comparison"
                src="/?embedded=visitor"
              />
            </section>
            <section>
              <h2>
                Venue representative <small>Send your answer here</small>
              </h2>
              <iframe
                title="Representative reply"
                src={`/rooms/${access.id}?embedded=representative#key=${access.representativeKey}`}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
