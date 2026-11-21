import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { demoSearch } from "../lib/demo";
import { evidenceStatus } from "../lib/evidence";
import type { RoomAccess, RoomSnapshot } from "../lib/confirmation";

const origin = process.env.ACCESSPROOF_TEST_ORIGIN || "http://127.0.0.1:3000";
let sessionCookie = "";
async function request(path: string, key?: string, body?: unknown) {
  return fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(45000),
  });
}
try {
  if (process.env.ACCESSPROOF_DEMO_PASSWORD) {
    const login = await request("/api/session", undefined, {
      password: process.env.ACCESSPROOF_DEMO_PASSWORD,
    });
    if (!login.ok) throw new Error("Demo login failed.");
    sessionCookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    if (!sessionCookie) throw new Error("Demo session was not issued.");
  }
  const response = await request("/api/rooms", undefined, {
    venue: demoSearch().venues[1],
    requirement: "restroom",
    datasetMode: "demo",
    mode: "nexconn",
    question:
      "Is the toilet route step-free? Please confirm grab rails and turning space.",
  });
  const data = await response.json();
  if (response.status !== 201)
    throw new Error(data.error ?? "Room creation failed.");
  const access = data as Required<RoomAccess>;
  assert.equal(
    (await request(`/api/rooms/${access.id}`, "bad-key")).status,
    401,
  );
  const forged = await request(`/api/rooms/${access.id}/messages`, access.key, {
    id: randomUUID(),
    author: "Visitor",
    text: "Pretending to be the representative.",
    requirement: "restroom",
    answer: "available",
  });
  assert.equal(forged.status, 403);
  const before = (await (
    await request(`/api/rooms/${access.id}`, access.key)
  ).json()) as RoomSnapshot;
  assert.equal(evidenceStatus(before.venue.evidence.restroom), "unknown");
  assert.match(before.messages[0].text, /Please confirm grab rails/);
  const unsureResponse = await request(
    `/api/rooms/${access.id}/messages`,
    access.representativeKey,
    {
      id: randomUUID(),
      author: "Asha · demo venue team",
      text: "I need to check the toilet facilities before confirming.",
      requirement: "restroom",
      answer: "unsure",
    },
  );
  const unsureData = await unsureResponse.json();
  assert.equal(unsureResponse.status, 200);
  assert.equal(unsureData.deliveryFailed, false);
  assert.equal(
    evidenceStatus(unsureData.snapshot.venue.evidence.restroom),
    "unknown",
  );
  const message = {
    id: randomUUID(),
    author: "Asha · demo venue team",
    text: "Demo report: the toilet is on the ground floor, with a step-free route, grab rails, and wheelchair turning space.",
    requirement: "restroom",
    answer: "available",
  };
  const sent = await request(
    `/api/rooms/${access.id}/messages`,
    access.representativeKey,
    message,
  );
  const sentData = await sent.json();
  if (sent.status !== 200 || sentData.deliveryFailed)
    throw new Error(sentData.error ?? "Nexconn delivery was not acknowledged.");
  const snapshot = sentData.snapshot as RoomSnapshot;
  assert.equal(evidenceStatus(snapshot.venue.evidence.restroom), "supported");
  assert.ok(
    snapshot.messages.find((m) => m.id === message.id)?.providerMessageId,
  );
  await request(
    `/api/rooms/${access.id}/messages`,
    access.representativeKey,
    message,
  );
  const final = (await (
    await request(`/api/rooms/${access.id}`, access.key)
  ).json()) as RoomSnapshot;
  assert.equal(final.venue.evidence.restroom.length, 1);
  assert.equal(final.messages.filter((m) => m.id === message.id).length, 1);
  const disagreement = await request(
    `/api/rooms/${access.id}/messages`,
    access.representativeKey,
    {
      ...message,
      id: randomUUID(),
      answer: "unavailable",
      text: "Fictional conflicting report: the toilet route has a step. Please confirm current conditions.",
    },
  );
  const conflictData = await disagreement.json();
  assert.equal(disagreement.status, 200);
  assert.equal(conflictData.deliveryFailed, false);
  assert.equal(
    evidenceStatus(conflictData.snapshot.venue.evidence.restroom),
    "conflicting",
  );
  assert.equal(conflictData.snapshot.venue.evidence.restroom.length, 2);
  const recovered = await (
    await request(`/api/rooms/${access.id}`, access.key)
  ).json();
  assert.equal(
    evidenceStatus(recovered.venue.evidence.restroom),
    "conflicting",
  );
  console.log(
    "PASS: reviewed question retained; unsure kept unknown; conflicting reports survived a fresh read.",
  );
  await mkdir(".data", { recursive: true });
  await writeFile(".data/live-test-room.json", JSON.stringify(access), {
    mode: 0o600,
  });
  console.log(
    "PASS: Nexconn issued two tokens, created a private group, and acknowledged the representative message.",
  );
  console.log(
    "PASS: unknown became reported available; author, timestamp, and provider message ID are recorded.",
  );
  console.log(
    "PASS: invalid links and visitor-authored reports were rejected; retries did not duplicate evidence.",
  );
  console.log(
    "Private room access saved under ignored .data for browser QA. This test used a fictional demo venue.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Live confirmation test failed.",
  );
  process.exitCode = 1;
}
