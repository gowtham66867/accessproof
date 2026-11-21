import test from "node:test";
import assert from "node:assert/strict";
import { demoSearch } from "../lib/demo";
import { createSearchCache } from "../lib/search-cache";
import {
  evidenceUpdates,
  updateAnnouncement,
  withRoomEvidence,
  type RoomSnapshot,
  type RoomMessage,
} from "../lib/confirmation";
import { visitSummary } from "../lib/visit-summary";
import { createRoomSchema } from "../lib/room-validation";

const message: RoomMessage = {
  id: "123",
  role: "representative",
  author: "Asha",
  text: "Ground-floor toilet with grab rails.",
  createdAt: "2026-11-21T11:00:00Z",
  requirement: "restroom",
  answer: "available",
  delivery: "delivered",
};
const room: RoomSnapshot = {
  id: "apjourney",
  role: "visitor",
  mode: "nexconn",
  venue: demoSearch().venues[1],
  datasetMode: "demo",
  requirement: "restroom",
  messages: [],
  createdAt: message.createdAt,
  expiresAt: "2026-11-22T11:00:00Z",
};
test("live transition retains the before/after status and author, without replay on reload", () => {
  const next = {
    ...room,
    messages: [message],
    venue: withRoomEvidence(room.venue, [message], room),
  };
  const [change] = evidenceUpdates(room, next);
  assert.equal(change.before, "unknown");
  assert.equal(change.after, "supported");
  assert.equal(change.author, "Asha");
  assert.match(updateAnnouncement(change), /Unknown to Reported available/);
  assert.deepEqual(evidenceUpdates(next, next), []);
  const unsure = { ...message, id: "unsure", answer: "unsure" as const };
  assert.deepEqual(evidenceUpdates(room, { ...room, messages: [unsure] }), []);
});
test("a second opposite report announces conflict rather than overwriting evidence", () => {
  const before = {
    ...room,
    messages: [message],
    venue: withRoomEvidence(room.venue, [message], room),
  };
  const opposite = { ...message, id: "second", answer: "unavailable" as const };
  const next = {
    ...before,
    messages: [message, opposite],
    venue: withRoomEvidence(room.venue, [message, opposite], room),
  };
  const [change] = evidenceUpdates(before, next);
  assert.equal(change.before, "supported");
  assert.equal(change.after, "conflicting");
  assert.equal(next.venue.evidence.restroom.length, 2);
});
test("visit summary includes unresolved needs and source dates, excludes room capabilities and transcript", () => {
  const venue = withRoomEvidence(room.venue, [message], room);
  const summary = visitSummary([venue], ["restroom", "entrance"], {
    restroom: "Right-side transfer space",
  });
  assert.match(summary, /Right-side transfer space/);
  assert.match(summary, /Reported 2026/);
  assert.match(summary, /2 of 2/);
  assert.equal(summary.includes(room.id), false);
  assert.equal(summary.includes("#key="), false);
  assert.match(
    visitSummary([room.venue], ["restroom"], {}),
    /Outstanding question/,
  );
});
test("custom questions must be bounded and are accepted without broadening room permissions", () => {
  const base = {
    venue: room.venue,
    requirement: "restroom",
    datasetMode: "demo",
    mode: "nexconn",
  };
  assert.equal(
    createRoomSchema.safeParse({
      ...base,
      question: "Is right-side transfer space available?",
    }).success,
    true,
  );
  assert.equal(
    createRoomSchema.safeParse({ ...base, question: "?" }).success,
    false,
  );
  assert.equal(
    createRoomSchema.safeParse({ ...base, question: "x".repeat(1501) }).success,
    false,
  );
});
test("search cache coalesces repeated requests, expires, and caps fresh search spending", async () => {
  let time = 0,
    calls = 0;
  const search = createSearchCache({
    now: () => time,
    ttl: 100,
    limit: 2,
    windowMs: 1000,
  });
  const load = async () => {
    calls++;
    return demoSearch();
  };
  const [first, second] = await Promise.all([
    search("Cafés", "Bengaluru", load),
    search("cafés", "bengaluru", load),
  ]);
  assert.equal(calls, 1);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  time = 101;
  await search("cafés", "Bengaluru", load);
  assert.equal(calls, 2);
  await assert.rejects(
    search("restaurants", "Bengaluru", load),
    /SEARCH_LIMIT/,
  );
  time = 1001;
  await search("restaurants", "Bengaluru", load);
  assert.equal(calls, 3);
});
