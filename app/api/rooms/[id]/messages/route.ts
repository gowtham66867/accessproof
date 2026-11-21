import { NextResponse } from "next/server";
import { messageSchema } from "@/lib/room-validation";
import {
  addMessage,
  authorizeRoom,
  roomMessages,
  roomSnapshot,
  updateMessage,
} from "@/lib/room-store";
import { publishNexconnMessage } from "@/lib/nexconn-server";
import type { RoomMessage } from "@/lib/confirmation";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await authorizeRoom(
    id,
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "",
  );
  if (!auth)
    return NextResponse.json(
      { error: "This room link is invalid or has expired." },
      { status: 401 },
    );
  const body = await request.text();
  if (body.length > 10000)
    return NextResponse.json(
      { error: "Message is too long." },
      { status: 413 },
    );
  let parsed;
  try {
    parsed = messageSchema.safeParse(JSON.parse(body));
  } catch {
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  }
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          "Add your name, a message (3–2000 characters), and both a feature and answer for a report.",
      },
      { status: 400 },
    );
  if (parsed.data.answer && auth.role !== "representative")
    return NextResponse.json(
      { error: "Only the invited representative can submit a feature report." },
      { status: 403 },
    );
  const messages = await roomMessages(id);
  let message = messages.find((m) => m.id === parsed.data.id);
  if (message && message.role !== auth.role)
    return NextResponse.json(
      { error: "Message ID is already in use." },
      { status: 409 },
    );
  if (!message) {
    if (
      messages.length >= 150 ||
      messages.filter((m) => Date.parse(m.createdAt) > Date.now() - 10000)
        .length >= 8
    )
      return NextResponse.json(
        { error: "Please wait before sending more messages." },
        { status: 429 },
      );
    message = {
      ...parsed.data,
      role: auth.role,
      createdAt: new Date().toISOString(),
      delivery: auth.room.mode === "nexconn" ? "pending" : "delivered",
    } as RoomMessage;
    await addMessage(id, message);
  }
  if (message.delivery !== "delivered" && auth.room.mode === "nexconn") {
    try {
      message.providerMessageId = await publishNexconnMessage(
        id,
        auth.role === "visitor"
          ? auth.room.visitorId
          : auth.room.representativeId,
        message.id,
        message.text,
      );
      message.delivery = "delivered";
      message.deliveredAt = new Date().toISOString();
    } catch {
      message.delivery = "failed";
    }
    await updateMessage(id, message);
  }
  return NextResponse.json(
    {
      snapshot: await roomSnapshot(auth.room, auth.role),
      deliveryFailed: message.delivery === "failed",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
