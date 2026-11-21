import { NextResponse } from "next/server";
import {
  correctDemoPassword,
  createDemoSession,
  demoCookie,
} from "@/lib/demo-auth";
const attempts = new Map<string, { count: number; reset: number }>();
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const previous = attempts.get(ip);
  const state =
    previous && previous.reset > Date.now()
      ? previous
      : { count: 0, reset: Date.now() + 60000 };
  if (state.count >= 8)
    return NextResponse.json(
      { error: "Please wait a minute before trying again." },
      { status: 429 },
    );
  state.count++;
  attempts.set(ip, state);
  if (attempts.size > 1000)
    for (const [key, entry] of attempts)
      if (entry.reset < Date.now()) attempts.delete(key);
  let data;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Enter the demo passphrase." },
      { status: 400 },
    );
  }
  if (
    typeof data.password !== "string" ||
    data.password.length > 256 ||
    !correctDemoPassword(data.password)
  )
    return NextResponse.json(
      { error: "That passphrase did not match." },
      { status: 401 },
    );
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(demoCookie, createDemoSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 86400,
    path: "/",
  });
  return response;
}
