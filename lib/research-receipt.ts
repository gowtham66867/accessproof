import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AgentResearch } from "./agent";
import type { Requirement, Venue } from "./evidence";
const localKey = randomBytes(32).toString("hex");
const serverKey = () => process.env.ACCESSPROOF_DEMO_PASSWORD || process.env.NEXCONN_APP_SECRET || localKey;
const fingerprint = (venue: Venue) => createHash("sha256").update(JSON.stringify([venue.id, venue.name, venue.address, venue.evidence])).digest("hex");
export function issueResearchReceipt(run: AgentResearch, venue: Venue, key = serverKey(), now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ run, fingerprint: fingerprint(venue), issuedAt: now })).toString("base64url");
  return body + "." + createHmac("sha256", key).update(body).digest("base64url");
}
export function readResearchReceipt(receipt: string, venue: Venue, requirement: Requirement, mode: "live" | "demo", key = serverKey(), now = Date.now()): AgentResearch | null {
  try {
    if (receipt.length > 32000) return null;
    const [body, signature, extra] = receipt.split(".");
    if (!body || !signature || extra) return null;
    const expected = createHmac("sha256", key).update(body).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (data.issuedAt > now + 30000 || now - data.issuedAt > 3600000 || data.fingerprint !== fingerprint(venue) || data.run.requirement !== requirement || data.run.mode !== mode || !data.run.brief) return null;
    return data.run;
  } catch { return null; }
}
