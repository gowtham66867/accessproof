import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { createRoomSchema } from "@/lib/room-validation";
import {
  addMessage,
  hashCapability,
  newCapability,
  saveRoom,
  recentRoomCount,
  updateMessage,
  type StoredRoom,
} from "@/lib/room-store";
import {
  createNexconnRoom,
  nexconnConfig,
  publishNexconnMessage,
} from "@/lib/nexconn-server";
import { questionFor, type RoomMessage } from "@/lib/confirmation";
import { authorizedDemoRequest } from "@/lib/demo-auth";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!authorizedDemoRequest(request))
    return NextResponse.json(
      { error: "Unlock the demo before creating a room." },
      { status: 401 },
    );
  let sameOrigin = false;
  try {
    sameOrigin =
      new URL(request.headers.get("origin") ?? "").host ===
      request.headers.get("host");
  } catch {
    /* Missing or invalid origin. */
  }
  if (!sameOrigin)
    return NextResponse.json(
      { error: "Create rooms from AccessProof." },
      { status: 403 },
    );
  if ((await recentRoomCount()) >= 30)
    return NextResponse.json(
      {
        error: "This demo server has reached its room limit. Try again later.",
      },
      { status: 429 },
    );
  const body = await request.text();
  if (body.length > 40000)
    return NextResponse.json(
      { error: "Room request is too large." },
      { status: 413 },
    );
  let parsed;
  try {
    parsed = createRoomSchema.safeParse(JSON.parse(body));
  } catch {
    return NextResponse.json(
      { error: "Invalid room request." },
      { status: 400 },
    );
  }
  if (!parsed.success)
    return NextResponse.json(
      { error: "Check the venue and selected requirement." },
      { status: 400 },
    );
  if (
    parsed.data.mode === "rehearsal" &&
    process.env.NODE_ENV === "production" &&
    process.env.ACCESSPROOF_ENABLE_REHEARSAL !== "true"
  )
    return NextResponse.json(
      { error: "Local rehearsal is disabled on this server." },
      { status: 403 },
    );
  if (parsed.data.mode === "nexconn") {
    try {
      nexconnConfig();
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Nexconn is not configured.",
        },
        { status: 503 },
      );
    }
  }
  const id = "ap" + randomBytes(12).toString("hex");
  const visitorKey = newCapability(),
    representativeKey = newCapability();
  const room: StoredRoom = {
    ...parsed.data,
    id,
    visitorId: id + "v",
    representativeId: id + "r",
    visitorHash: hashCapability(visitorKey),
    representativeHash: hashCapability(representativeKey),
    tokens: { visitor: "", representative: "" },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  try {
    if (room.mode === "nexconn")
      room.tokens = await createNexconnRoom(
        id,
        room.visitorId,
        room.representativeId,
      );
    await saveRoom(room);
    const message: RoomMessage = {
      id: randomUUID(),
      role: "visitor",
      author: "Visitor",
      text: parsed.data.question ?? questionFor(room.requirement),
      createdAt: room.createdAt,
      delivery: room.mode === "nexconn" ? "pending" : "delivered",
    };
    await addMessage(id, message);
    // The first question is durable in the room even if the peer has not connected yet.
    if (room.mode === "nexconn") {
      try {
        message.providerMessageId = await publishNexconnMessage(
          id,
          room.visitorId,
          message.id,
          message.text,
        );
        message.delivery = "delivered";
      } catch {
        message.delivery = "failed";
      }
      await updateMessage(id, message);
    }
    return NextResponse.json(
      { id, key: visitorKey, representativeKey },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not create the Nexconn room. Check Chat activation, credentials, and region. No rehearsal room was substituted.",
      },
      { status: 502 },
    );
  }
}
