import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
export const demoCookie = "accessproof_demo";
const password = () => process.env.ACCESSPROOF_DEMO_PASSWORD;
export const demoAuthRequired = () =>
  Boolean(password() || process.env.K_SERVICE);
export function correctDemoPassword(value: string) {
  const expected = password();
  return Boolean(
    expected &&
    Buffer.byteLength(value) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(value), Buffer.from(expected)),
  );
}
export function createDemoSession() {
  const expires = String(Date.now() + 86400000);
  return `${expires}.${createHmac("sha256", password()!).update(expires).digest("base64url")}`;
}
export function validDemoSession(value?: string) {
  if (!demoAuthRequired()) return true;
  if (!password() || !value) return false;
  const [expires, signature] = value.split(".");
  if (
    !expires ||
    !signature ||
    !/^\d+$/.test(expires) ||
    Number(expires) < Date.now()
  )
    return false;
  const expected = createHmac("sha256", password()!)
    .update(expires)
    .digest("base64url");
  return (
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}
export function authorizedDemoRequest(request: Request) {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(demoCookie + "="))
    ?.slice(demoCookie.length + 1);
  return validDemoSession(value);
}
