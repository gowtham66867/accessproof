import { DatabaseSync } from "node:sqlite";
import type { Firestore } from "@google-cloud/firestore";
import { mkdirSync } from "node:fs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import {
  withRoomEvidence,
  type RoomMessage,
  type RoomRole,
  type RoomSnapshot,
  type RoomMode,
} from "./confirmation";
import type { Requirement, Venue } from "./evidence";

export type StoredRoom = {
  id: string;
  mode: RoomMode;
  venue: Venue;
  datasetMode: "demo" | "live";
  requirement: Requirement;
  visitorHash: string;
  representativeHash: string;
  visitorId: string;
  representativeId: string;
  tokens: { visitor: string; representative: string };
  createdAt: string;
  expiresAt: string;
};
let db: DatabaseSync | undefined;
function database() {
  if (!db) {
    const dir =
      process.env.ACCESSPROOF_DATA_DIR || join(process.cwd(), ".data");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    db = new DatabaseSync(join(dir, "confirmations.sqlite"));
    db.exec(
      "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, body TEXT NOT NULL); CREATE INDEX IF NOT EXISTS messages_room ON messages(room_id);",
    );
  }
  return db;
}
let firestore: Promise<Firestore> | undefined;
const cloudStorage = () => process.env.ACCESSPROOF_STORAGE === "firestore";
async function cloudRooms() {
  firestore ??= import("@google-cloud/firestore").then(
    ({ Firestore }) =>
      new Firestore({
        projectId: process.env.GOOGLE_CLOUD_PROJECT,
        databaseId: process.env.FIRESTORE_DATABASE_ID || "(default)",
        ignoreUndefinedProperties: true,
      }),
  );
  return (await firestore).collection("accessproof_rooms");
}
export const newCapability = () => randomBytes(32).toString("base64url");
export const hashCapability = (key: string) =>
  createHash("sha256").update(key).digest("hex");
export async function saveRoom(room: StoredRoom) {
  if (cloudStorage()) {
    await (await cloudRooms()).doc(room.id).create({ ...room, messages: [] });
    return;
  }
  database()
    .prepare("INSERT INTO rooms(id,body) VALUES (?,?)")
    .run(room.id, JSON.stringify(room));
}
export async function recentRoomCount() {
  const since = new Date(Date.now() - 3600000).toISOString();
  if (cloudStorage())
    return (
      await (await cloudRooms()).where("createdAt", ">=", since).count().get()
    ).data().count;
  return (
    database()
      .prepare(
        "SELECT COUNT(*) AS count FROM rooms WHERE json_extract(body, '$.createdAt') >= ?",
      )
      .get(since) as { count: number }
  ).count;
}
export async function loadRoom(id: string): Promise<StoredRoom | null> {
  if (
    !/^ap[a-zA-Z0-9]{1,62}$/.test(id) &&
    !["expired", "does-not-exist"].includes(id)
  )
    return null;
  if (cloudStorage()) {
    const data = (await (await cloudRooms()).doc(id).get()).data();
    if (!data) return null;
    const { messages: _messages, ...room } = data;
    return room as StoredRoom;
  }
  const row = database()
    .prepare("SELECT body FROM rooms WHERE id = ?")
    .get(id) as { body: string } | undefined;
  return row ? JSON.parse(row.body) : null;
}
export async function authorizeRoom(
  id: string,
  key: string,
): Promise<{ room: StoredRoom; role: RoomRole } | null> {
  if (!key || key.length > 128) return null;
  const room = await loadRoom(id);
  if (!room || Date.parse(room.expiresAt) <= Date.now()) return null;
  const hash = Buffer.from(hashCapability(key), "hex");
  if (timingSafeEqual(hash, Buffer.from(room.visitorHash, "hex")))
    return { room, role: "visitor" };
  if (timingSafeEqual(hash, Buffer.from(room.representativeHash, "hex")))
    return { room, role: "representative" };
  return null;
}
export async function roomMessages(id: string): Promise<RoomMessage[]> {
  if (cloudStorage())
    return ((await (await cloudRooms()).doc(id).get()).data()?.messages ??
      []) as RoomMessage[];
  return (
    database()
      .prepare("SELECT body FROM messages WHERE room_id = ? ORDER BY rowid")
      .all(id) as { body: string }[]
  ).map((row) => JSON.parse(row.body));
}
export async function addMessage(
  roomId: string,
  message: RoomMessage,
): Promise<RoomMessage> {
  if (cloudStorage()) {
    const ref = (await cloudRooms()).doc(roomId);
    return ref.firestore.runTransaction(async (transaction) => {
      const data = (await transaction.get(ref)).data();
      if (!data) throw new Error("Room unavailable.");
      const messages = (data.messages ?? []) as RoomMessage[];
      const existing = messages.find((m) => m.id === message.id);
      if (existing) return existing;
      if (messages.length >= 150)
        throw new Error("Room message limit reached.");
      transaction.update(ref, { messages: [...messages, message] });
      return message;
    });
  }
  database()
    .prepare("INSERT OR IGNORE INTO messages(id,room_id,body) VALUES (?,?,?)")
    .run(message.id, roomId, JSON.stringify(message));
  const row = database()
    .prepare("SELECT body FROM messages WHERE id = ? AND room_id = ?")
    .get(message.id, roomId) as { body: string } | undefined;
  if (!row) throw new Error("Message ID is already in use.");
  return JSON.parse(row.body);
}
export async function updateMessage(roomId: string, message: RoomMessage) {
  if (cloudStorage()) {
    const ref = (await cloudRooms()).doc(roomId);
    await ref.firestore.runTransaction(async (transaction) => {
      const data = (await transaction.get(ref)).data();
      if (!data) throw new Error("Room unavailable.");
      const messages = (data.messages ?? []) as RoomMessage[];
      transaction.update(ref, {
        messages: messages.map((old) =>
          old.id === message.id && old.delivery !== "delivered" ? message : old,
        ),
      });
    });
    return;
  }
  database()
    .prepare("UPDATE messages SET body = ? WHERE id = ? AND room_id = ?")
    .run(JSON.stringify(message), message.id, roomId);
}
export async function roomSnapshot(
  room: StoredRoom,
  role: RoomRole,
): Promise<RoomSnapshot> {
  const messages = await roomMessages(room.id);
  return {
    id: room.id,
    mode: room.mode,
    role,
    venue: withRoomEvidence(room.venue, messages, room),
    datasetMode: room.datasetMode,
    requirement: room.requirement,
    messages,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
  };
}
