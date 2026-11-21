import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { demoSearch } from "../lib/demo";
import { evidenceStatus } from "../lib/evidence";
import {
  reportFromMessage,
  withRoomEvidence,
  type RoomMessage,
} from "../lib/confirmation";
import {
  authorizeRoom,
  hashCapability,
  newCapability,
  saveRoom,
  type StoredRoom,
} from "../lib/room-store";
import { messageSchema } from "../lib/room-validation";

const message: RoomMessage = {
  id: randomUUID(),
  role: "representative",
  author: "Asha · demo representative",
  text: "The ground-floor toilet has grab rails and wheelchair turning space.",
  createdAt: "2026-11-21T10:00:00Z",
  requirement: "restroom",
  answer: "available",
  delivery: "delivered",
};
const room = { id: "aptest", mode: "nexconn" as const };
test("only delivered, definite representative answers become evidence", () => {
  assert.equal(reportFromMessage({ ...message, role: "visitor" }, room), null);
  assert.equal(reportFromMessage({ ...message, answer: "unsure" }, room), null);
  assert.equal(
    reportFromMessage({ ...message, delivery: "failed" }, room),
    null,
  );
  assert.equal(
    reportFromMessage({ ...message, delivery: "pending" }, room),
    null,
  );
  const evidence = reportFromMessage(message, room)!;
  assert.equal(evidence.author, message.author);
  assert.equal(evidence.publishedAt, message.createdAt);
  assert.equal(evidence.id, message.id);
});
test("a representative answer resolves unknown and repeated snapshots do not duplicate evidence", () => {
  const venue = demoSearch().venues[1];
  assert.equal(evidenceStatus(venue.evidence.restroom), "unknown");
  const updated = withRoomEvidence(venue, [message, message], room);
  assert.equal(evidenceStatus(updated.evidence.restroom), "supported");
  assert.equal(updated.evidence.restroom.length, 1);
  const again = withRoomEvidence(updated, [message], room);
  assert.equal(again.evidence.restroom.length, 1);
});
test("representative disagreement preserves the original negative report", () => {
  const venue = demoSearch().venues[2];
  const updated = withRoomEvidence(venue, [message], room);
  assert.equal(evidenceStatus(updated.evidence.restroom), "conflicting");
  assert.equal(
    updated.evidence.restroom[0].excerpt,
    venue.evidence.restroom[0].excerpt,
  );
  assert.equal(venue.evidence.restroom.length, 1);
});
test("room capabilities separate roles, reject guesses, and expire", async () => {
  process.env.ACCESSPROOF_DATA_DIR = mkdtempSync(
    join(tmpdir(), "accessproof-test-"),
  );
  const visitor = newCapability(),
    representative = newCapability();
  const stored: StoredRoom = {
    ...room,
    venue: demoSearch().venues[1],
    datasetMode: "demo",
    requirement: "restroom",
    visitorHash: hashCapability(visitor),
    representativeHash: hashCapability(representative),
    visitorId: "v",
    representativeId: "r",
    tokens: { visitor: "test-v", representative: "test-r" },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };
  await saveRoom(stored);
  assert.equal((await authorizeRoom(room.id, visitor))?.role, "visitor");
  assert.equal(
    (await authorizeRoom(room.id, representative))?.role,
    "representative",
  );
  assert.equal(await authorizeRoom(room.id, "guessed"), null);
  assert.equal(await authorizeRoom("does-not-exist", visitor), null);
  await saveRoom({
    ...stored,
    id: "expired",
    expiresAt: "2000-01-01T00:00:00Z",
  });
  assert.equal(await authorizeRoom("expired", visitor), null);
});
test("a structured report needs both its feature and answer", () => {
  const base = {
    id: randomUUID(),
    text: "Please check the toilet.",
    author: "Sam",
  };
  assert.equal(messageSchema.safeParse(base).success, true);
  assert.equal(
    messageSchema.safeParse({ ...base, answer: "available" }).success,
    false,
  );
  assert.equal(
    messageSchema.safeParse({ ...base, requirement: "restroom" }).success,
    false,
  );
  assert.equal(
    messageSchema.safeParse({
      ...base,
      requirement: "restroom",
      answer: "unsure",
    }).success,
    true,
  );
});
