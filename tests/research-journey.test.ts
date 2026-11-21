import test from "node:test";
import assert from "node:assert/strict";
import { runResearchAgent } from "../lib/agent";
import { issueResearchReceipt, readResearchReceipt } from "../lib/research-receipt";
import { demoSearch } from "../lib/demo";
import { roomTimeline } from "../lib/timeline";
import { withRoomEvidence, type RoomSnapshot, type RoomMessage } from "../lib/confirmation";
const venue = demoSearch().venues[1];
const source = { title: "Juniper Coffee House Indiranagar", link: "https://example.org/access", snippet: "Juniper Coffee House Indiranagar wheelchair entrance is reported. Toilet route needs confirmation." };
const research = () => runResearchAgent({ venue, requirement: "restroom", mode: "demo" }, async () => [source]);
test("brief findings are exact cited excerpts and separate reported facts from unanswered conditions", async () => {
  const run = await research();
  assert.equal(run.brief.findings.length, 1);
  assert.equal(run.brief.findings[0].text, run.clues[0].excerpt);
  assert.equal(run.brief.findings[0].citation, 1);
  assert.ok(run.brief.reported.some(r => r.feature === "Entrance"));
  assert.match(run.brief.unanswered.join(" "), /entrance to the toilet/);
  assert.match(run.draftQuestion, /toilet route is still a separate check/);
  assert.match(run.brief.summary, /do not establish/);
});
test("empty source checks cannot manufacture findings or an agreement claim", async () => {
  const run = await runResearchAgent({ venue, requirement: "restroom", mode: "live" }, async () => []);
  assert.deepEqual(run.brief.findings, []);
  assert.match(run.brief.disagreement, /not confirmation that sources agree/);
});
test("a research receipt binds the entire brief to venue, evidence, mode and feature", async () => {
  const run = await research(), at = Date.now();
  const token = issueResearchReceipt(run, venue, "private-test-key", at);
  assert.deepEqual(readResearchReceipt(token, venue, "restroom", "demo", "private-test-key", at), run);
  assert.equal(readResearchReceipt(token, { ...venue, name: "Another venue" }, "restroom", "demo", "private-test-key", at), null);
  assert.equal(readResearchReceipt(token, { ...venue, evidence: { ...venue.evidence, restroom: venue.evidence.entrance } }, "restroom", "demo", "private-test-key", at), null);
  assert.equal(readResearchReceipt(token, venue, "entrance", "demo", "private-test-key", at), null);
  assert.equal(readResearchReceipt(token, venue, "restroom", "live", "private-test-key", at), null);
});
test("tampered, expired, wrong-key and malformed receipts are rejected", async () => {
  const run = await research(), at = Date.now(), token = issueResearchReceipt(run, venue, "key", at);
  const [body, sig] = token.split(".");
  const data = JSON.parse(Buffer.from(body, "base64url").toString()); data.run.brief.summary = "Everything certified";
  const tampered = Buffer.from(JSON.stringify(data)).toString("base64url") + "." + sig;
  for (const receipt of [tampered, "bad", token + ".extra"]) assert.equal(readResearchReceipt(receipt, venue, "restroom", "demo", "key", at), null);
  assert.equal(readResearchReceipt(token, venue, "restroom", "demo", "wrong", at), null);
  assert.equal(readResearchReceipt(token, venue, "restroom", "demo", "key", at + 3600001), null);
});
const base: RoomSnapshot = { id: "apjourneybrief", mode: "nexconn", role: "visitor", datasetMode: "demo", venue, requirement: "restroom", createdAt: "2026-11-21T12:00:00.000Z", expiresAt: "2026-11-22T12:00:00.000Z", messages: [] };
const question: RoomMessage = { id: "question", role: "visitor", author: "Visitor", text: "Can you confirm the toilet route?", createdAt: base.createdAt, deliveredAt: "2026-11-21T12:00:02.000Z", delivery: "delivered" };
const reply: RoomMessage = { id: "reply", role: "representative", author: "Asha", text: "Ground floor toilet with grab rails.", createdAt: "2026-11-21T12:01:00.000Z", deliveredAt: "2026-11-21T12:01:04.000Z", delivery: "delivered", requirement: "restroom", answer: "available" };
function snapshot(messages: RoomMessage[]): RoomSnapshot { return { ...base, messages, venue: withRoomEvidence(venue, messages, base) }; }
test("timeline joins research, review, delivery and the exact cell reconciliation", async () => {
  const room = { ...snapshot([question, reply]), research: await research() };
  const events = roomTimeline(room);
  assert.deepEqual(events.map(e => e.label), ["Sources checked", "Question reviewed", "Question delivered", "Representative replied", "Table: Unknown → Reported available"]);
  assert.equal(events.at(-1)?.at, reply.deliveredAt);
  assert.match(events.at(-1)!.detail, /Asha/);
  assert.deepEqual(roomTimeline(JSON.parse(JSON.stringify(room))), events);
});
test("pending, failed and unsure messages never create a table-update milestone", () => {
  for (const delivery of ["pending", "failed"] as const) {
    const events = roomTimeline(snapshot([question, { ...reply, delivery, deliveredAt: undefined }]));
    assert.equal(events.some(e => e.id.startsWith("table:")), false);
    assert.equal(events.at(-1)?.state, delivery);
  }
  const events = roomTimeline(snapshot([question, { ...reply, answer: "unsure" }]));
  assert.equal(events.some(e => e.id.startsWith("table:")), false);
  assert.equal(events.at(-1)?.state, "unresolved");
});
test("opposing reports create a conflict milestone while retries do not duplicate milestones", () => {
  const opposite = { ...reply, id: "opposite", answer: "unavailable" as const };
  const events = roomTimeline(snapshot([question, reply, reply, opposite]));
  assert.equal(events.filter(e => e.id === "table:reply").length, 1);
  assert.equal(events.at(-1)?.label, "Table: Reported available → Conflicting reports");
  assert.equal(events.at(-1)?.state, "unresolved");
});
