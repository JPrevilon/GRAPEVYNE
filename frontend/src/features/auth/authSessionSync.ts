export type AuthSessionAction = "login" | "logout" | "signup";

interface AuthSessionMessage {
  action: AuthSessionAction;
  sequence: number;
  sourceId: string;
  type: "grapevyne-auth-session-changed";
  version: 1;
}

export interface AuthSessionSync {
  close: () => void;
  publish: (action: AuthSessionAction) => void;
}

const AUTH_CHANNEL_NAME = "grapevyne-auth-session-v1";
const AUTH_STORAGE_KEY = "grapevyne:auth-session-change:v1";

function createSourceId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function authSessionMessage(
  value: unknown,
): AuthSessionMessage | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const message = value as Partial<AuthSessionMessage>;

  if (
    message.version !== 1 ||
    message.type !== "grapevyne-auth-session-changed" ||
    typeof message.sequence !== "number" ||
    typeof message.sourceId !== "string" ||
    !["login", "logout", "signup"].includes(message.action ?? "")
  ) {
    return null;
  }

  return message as AuthSessionMessage;
}

function parseStoredMessage(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return authSessionMessage(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

export function createAuthSessionSync(
  onRemoteChange: (action: AuthSessionAction) => void,
): AuthSessionSync {
  const sourceId = createSourceId();
  let sequence = 0;
  const receive = (value: unknown) => {
    const message = authSessionMessage(value);

    if (message && message.sourceId !== sourceId) {
      onRemoteChange(message.action);
    }
  };
  const message = (action: AuthSessionAction): AuthSessionMessage => ({
    action,
    sequence: ++sequence,
    sourceId,
    type: "grapevyne-auth-session-changed",
    version: 1,
  });

  if (typeof window.BroadcastChannel === "function") {
    try {
      const channel = new window.BroadcastChannel(AUTH_CHANNEL_NAME);
      const handleMessage = (event: MessageEvent<unknown>) => receive(event.data);

      channel.addEventListener("message", handleMessage);

      return {
        close: () => {
          channel.removeEventListener("message", handleMessage);
          channel.close();
        },
        publish: (action) => channel.postMessage(message(action)),
      };
    } catch {
      // Fall through to storage events when BroadcastChannel is unavailable.
    }
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === AUTH_STORAGE_KEY) {
      receive(parseStoredMessage(event.newValue));
    }
  };

  window.addEventListener("storage", handleStorage);

  return {
    close: () => window.removeEventListener("storage", handleStorage),
    publish: (action) => {
      try {
        window.localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify(message(action)),
        );
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // Focus and visibility revalidation remain available if storage is blocked.
      }
    },
  };
}
