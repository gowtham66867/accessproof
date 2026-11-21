import { NextResponse } from "next/server";
import { authorizeRoom, roomSnapshot } from "@/lib/room-store";
export const runtime = "nodejs";
export async function GET(
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
  return NextResponse.json(await roomSnapshot(auth.room, auth.role), {
    headers: { "Cache-Control": "no-store" },
  });
}
