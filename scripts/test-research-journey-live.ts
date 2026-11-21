import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { demoSearch } from "../lib/demo";
import { roomTimeline } from "../lib/timeline";
import type { RoomSnapshot } from "../lib/confirmation";
const origin = process.env.ACCESSPROOF_TEST_ORIGIN || "http://127.0.0.1:3000";
let cookie = "";
async function req(path: string, body?: unknown, key?: string) {
  return fetch(origin + path, { method: body ? "POST" : "GET", headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(key ? { Authorization: `Bearer ${key}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(45000) });
}
if (process.env.ACCESSPROOF_DEMO_PASSWORD) {
  const login = await req("/api/session", { password: process.env.ACCESSPROOF_DEMO_PASSWORD });
  assert.equal(login.status, 200); cookie = login.headers.get("set-cookie")?.split(";")[0] || "";
}
const venue = demoSearch().venues[1];
const response = await req("/api/agent", { venue, mode: "demo", requirement: "restroom" });
const research = await response.json(); assert.equal(response.status, 200);
assert.equal(research.brief.findings.length, 2); assert.ok(research.receipt);
const input = { venue, mode: "nexconn", datasetMode: "demo", requirement: "restroom", question: research.draftQuestion, researchReceipt: research.receipt };
assert.equal((await req("/api/rooms", { ...input, researchReceipt: research.receipt + "bad" })).status, 400);
const create = await req("/api/rooms", input); const access = await create.json();
assert.equal(create.status, 201, access.error);
const before = await (await req(`/api/rooms/${access.id}`, undefined, access.key)).json() as RoomSnapshot;
assert.deepEqual(before.research?.brief, research.brief);
assert.deepEqual(roomTimeline(before).map(e => e.label), ["Sources checked", "Question reviewed", "Question delivered"]);
const unsureResponse = await req(`/api/rooms/${access.id}/messages`, { id: randomUUID(), author: "Asha · demo venue team", text: "Fictional demo: I need to check the toilet route before confirming.", requirement: "restroom", answer: "unsure" }, access.representativeKey);
const unsure = await unsureResponse.json();
assert.equal(unsureResponse.status, 200); assert.equal(unsure.deliveryFailed, false);
assert.equal(roomTimeline(unsure.snapshot).at(-1)?.label, "Representative needs to check");
assert.equal(roomTimeline(unsure.snapshot).some(e => e.id.startsWith("table:")), false);
const message = { id: randomUUID(), author: "Asha · demo venue team", text: "Fictional demo: ground-floor toilet, step-free route, grab rails and turning space. Clearances still need checking.", requirement: "restroom", answer: "available" };
const sent = await req(`/api/rooms/${access.id}/messages`, message, access.representativeKey); const data = await sent.json();
assert.equal(sent.status, 200); assert.equal(data.deliveryFailed, false);
assert.ok(data.snapshot.messages.find((m: { id: string; deliveredAt?: string }) => m.id === message.id).deliveredAt);
assert.equal(roomTimeline(data.snapshot).at(-1)?.label, "Table: Unknown → Reported available");
await req(`/api/rooms/${access.id}/messages`, message, access.representativeKey);
const restored = await (await req(`/api/rooms/${access.id}`, undefined, access.key)).json() as RoomSnapshot;
assert.deepEqual(restored.research?.brief, research.brief);
assert.equal(roomTimeline(restored).filter(e => e.id === "table:" + message.id).length, 1);
await mkdir(".data", { recursive: true }); await writeFile(".data/research-journey-test-room.json", JSON.stringify(access), { mode: 0o600 });
const oppositeResponse = await req(`/api/rooms/${access.id}/messages`, { ...message, id: randomUUID(), text: "Fictional conflicting report: the toilet route now has steps.", answer: "unavailable" }, access.representativeKey);
const opposite = await oppositeResponse.json(); assert.equal(opposite.deliveryFailed, false);
assert.equal(roomTimeline(opposite.snapshot).at(-1)?.label, "Table: Reported available → Conflicting reports");
const conflictRestored = await (await req(`/api/rooms/${access.id}`, undefined, access.key)).json() as RoomSnapshot;
assert.equal(roomTimeline(conflictRestored).at(-1)?.state, "unresolved");
console.log(JSON.stringify({ passed: true, unsureStayedUnresolved: true, conflictRetainedOnRefresh: true, fixtureCitations: research.brief.findings.length, timeline: roomTimeline(restored).map(e => e.label), signedReceiptTamperRejected: true, refreshRestored: true, retryDeduplicated: true }));
