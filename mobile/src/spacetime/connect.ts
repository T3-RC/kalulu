// Mobile connection helper for the vendored SpacetimeDB client.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { kalulu } from "./kalulu";

const TOKEN_KEY = "kalulu.stdb.token";
const STDB_URI = process.env.EXPO_PUBLIC_STDB_URI ?? "wss://maincloud.spacetimedb.com";
const STDB_DB = process.env.EXPO_PUBLIC_STDB_DB ?? "kalulu";

let connecting: Promise<void> | null = null;

/** Idempotent anonymous connect. Safe to call on every mount. */
export async function ensureConnected(): Promise<void> {
  if (kalulu.connected) return;
  if (connecting) return connecting;
  const token = (await AsyncStorage.getItem(TOKEN_KEY)) ?? undefined;
  connecting = kalulu
    .connect({
      uri: STDB_URI,
      dbName: STDB_DB,
      token,
      onToken: (t) => {
        AsyncStorage.setItem(TOKEN_KEY, t).catch(() => {});
      },
    })
    .finally(() => {
      connecting = null;
    });
  return connecting;
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export { kalulu };
export * from "./hooks";
