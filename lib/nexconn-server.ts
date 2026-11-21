import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const domains = {
  SG: "api.sg-light-api.com",
  NA: "api.us-light-api.com",
  SA: "api.sau-light-api.com",
} as const;
export function nexconnConfig() {
  const appKey = process.env.NEXCONN_APP_KEY?.trim();
  const secret = process.env.NEXCONN_APP_SECRET?.trim();
  const region = (process.env.NEXCONN_REGION ?? "SG") as keyof typeof domains;
  if (!appKey || !secret)
    throw new Error(
      "Add NEXCONN_APP_KEY and NEXCONN_APP_SECRET to .env.local to use Nexconn. Local rehearsal is available separately.",
    );
  if (!domains[region])
    throw new Error("NEXCONN_REGION must be SG, NA, or SA.");
  const base = new URL(
    process.env.NEXCONN_API_BASE_URL || `https://${domains[region]}`,
  );
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    !/^api(?:-b)?\.(?:sg|us|sau)-light-api\.com$/.test(base.hostname)
  )
    throw new Error("Use the HTTPS Nexconn API domain for your app region.");
  return { appKey, secret, region, base };
}
export async function nexconnRequest<T = Record<string, unknown>>(
  path: string,
  body: unknown,
): Promise<T> {
  const { appKey, secret, base } = nexconnConfig();
  const nonce = randomBytes(8).toString("hex");
  const timestamp = Date.now().toString();
  const signature = createHash("sha1")
    .update(secret + nonce + timestamp)
    .digest("hex");
  const response = await fetch(new URL(path, base), {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: {
      "Content-Type": "application/json",
      "App-Key": appKey,
      Nonce: nonce,
      Timestamp: timestamp,
      Signature: signature,
      "X-Request-ID": randomUUID(),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(
      "Nexconn could not complete the request. Check the app credentials, region, and enabled Chat service.",
    );
  const payload = (await response.json()) as { code?: number; result?: T };
  if (payload.code !== 0)
    throw new Error(
      "Nexconn rejected the request. Check the app credentials and Chat configuration.",
    );
  return payload.result as T;
}
export async function issueNexconnToken(userId: string, name: string) {
  const result = await nexconnRequest<{ accessToken: string; userId: string }>(
    "/v4/auth/access-token/issue",
    { userId, name },
  );
  if (!result?.accessToken || result.userId !== userId)
    throw new Error("Nexconn did not return a valid user token.");
  return result.accessToken;
}
export async function createNexconnRoom(
  id: string,
  visitorId: string,
  representativeId: string,
) {
  const [visitor, representative] = await Promise.all([
    issueNexconnToken(visitorId, "AccessProof visitor"),
    issueNexconnToken(representativeId, "Invited venue representative"),
  ]);
  await nexconnRequest("/v4/group-channel/create", {
    channelId: id,
    name: "AccessProof accessibility questions",
    owner: visitorId,
    userIds: [representativeId],
    permissions: { joinPerm: 3, invitePerm: 0 },
  });
  return { visitor, representative };
}
export async function publishNexconnMessage(
  roomId: string,
  fromUserId: string,
  id: string,
  text: string,
) {
  const result = await nexconnRequest<{
    messageIds?: { channelId: string; messageId: string }[];
  }>("/v4/group-channel/message/send", {
    fromUserId,
    toChannelIds: [roomId],
    messageType: "RC:TxtMsg",
    content: JSON.stringify({
      content: text,
      extra: JSON.stringify({ accessproofEventId: id, roomId }),
    }),
    isEchoToSender: 1,
    shouldPersist: 1,
    disablePush: true,
  });
  const providerId = result?.messageIds?.find(
    (m) => m.channelId === roomId,
  )?.messageId;
  if (!providerId)
    throw new Error(
      "Nexconn did not acknowledge delivery. The saved report can be retried.",
    );
  return providerId;
}
