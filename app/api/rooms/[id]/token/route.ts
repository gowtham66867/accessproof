import { NextResponse } from "next/server";
import { authorizeRoom } from "@/lib/room-store";
import { nexconnConfig } from "@/lib/nexconn-server";
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
  if (auth.room.mode !== "nexconn")
    return NextResponse.json(
      { error: "This room uses local rehearsal, not Nexconn." },
      { status: 409 },
    );
  const { appKey, region } = nexconnConfig();
  return NextResponse.json(
    {
      appKey,
      region,
      token: auth.room.tokens[auth.role],
      userId:
        auth.role === "visitor"
          ? auth.room.visitorId
          : auth.room.representativeId,
      channelId: id,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
