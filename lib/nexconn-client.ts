"use client";
type ChatSDK = typeof import("@nexconn/chat");
let sdkPromise: Promise<ChatSDK> | undefined;
let initializedKey: string | undefined;
let currentIdentity: string | undefined;
let connection: Promise<void> = Promise.resolve();

export async function subscribeNexconn(
  config: {
    appKey: string;
    region: "SG" | "NA" | "SA";
    token: string;
    userId: string;
    channelId: string;
  },
  onChange: () => void,
  onStatus: (value: string) => void,
) {
  sdkPromise ??= import("@nexconn/chat");
  const sdk = await sdkPromise;
  const {
    NCEngine,
    MessageHandler,
    ConnectionStatusHandler,
    AreaCode,
    LogLevel,
  } = sdk;
  if (!initializedKey) {
    NCEngine.initialize({
      appKey: config.appKey,
      areaCode: AreaCode[config.region],
      logLevel: LogLevel.ERROR,
    });
    initializedKey = config.appKey;
  } else if (initializedKey !== config.appKey) {
    throw new Error("The Nexconn app changed. Reload this page to reconnect.");
  }
  const handlerId = "ap" + crypto.randomUUID();
  let active = true;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const refresh = () => {
    if (!active) return;
    onChange();
    // Provider delivery can precede the server's delivery acknowledgement by a few milliseconds.
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (active) onChange();
    }, 700);
    timers.add(timer);
  };
  NCEngine.addMessageHandler(
    handlerId,
    new MessageHandler({
      onMessageReceived({ messages }) {
        if (
          messages.some(
            (m) => m.channelIdentifier.channelId === config.channelId,
          )
        )
          refresh();
      },
    }),
  );
  NCEngine.addConnectionStatusHandler(
    handlerId,
    new ConnectionStatusHandler({
      onConnectionStatusChanged({ status }) {
        if (!active) return;
        // The enum comes from the installed engine package.
        onStatus(
          status === sdk.ConnectionStatus.CONNECTED
            ? "Nexconn connected"
            : status === sdk.ConnectionStatus.CONNECTING
              ? "Connecting to Nexconn…"
              : "Nexconn disconnected · reconnecting",
        );
        refresh();
      },
    }),
  );
  const cleanup = () => {
    active = false;
    timers.forEach(clearTimeout);
    NCEngine.removeMessageHandler(handlerId);
    NCEngine.removeConnectionStatusHandler(handlerId);
  };
  if (currentIdentity !== config.userId) {
    const previousIdentity = currentIdentity;
    currentIdentity = config.userId;
    connection = connection
      .catch(() => {})
      .then(async () => {
        if (previousIdentity) await NCEngine.disconnect();
        const result = await NCEngine.connect({ token: config.token });
        if (!result.isOk) {
          currentIdentity = undefined;
          throw new Error(
            `Nexconn connection failed (${result.code}). Check region and Chat activation.`,
          );
        }
      });
  }
  try {
    await connection;
    if (active) {
      onStatus("Nexconn connected");
      refresh();
    }
  } catch (error) {
    cleanup();
    throw error;
  }
  return cleanup;
}
