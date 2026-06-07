/**
 * Mobile adapter for the shared Kalulu SpacetimeDB client.
 *
 * Wires Expo/React Native token persistence (AsyncStorage) into the shared
 * client and re-exports the hooks so screens can import everything from here.
 *
 * MIGRATION: screens currently using `services/api.js` (REST) should switch to
 * these hooks. Mapping:
 *   api.getPosts()      -> usePosts(bounds)
 *   api.getEvents()     -> useEvents()
 *   api.likePost(id)    -> useLikes(id).toggle()
 *   api.createPost(...) -> useKalulu().createPost(...)
 * Once every screen is migrated, delete `services/api.js`.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { kalulu } from "../../../spacetimedb/client/src/kalulu";

const TOKEN_KEY = "kalulu.stdb.token";

// Point at your deployed module in production via app config / env.
const STDB_URI = process.env.EXPO_PUBLIC_STDB_URI ?? "ws://localhost:3000";
const STDB_DB = process.env.EXPO_PUBLIC_STDB_DB ?? "kalulu";

let connecting: Promise<void> | null = null;

/** Idempotent connect — safe to call from the root component on every mount. */
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
export * from "../../../spacetimedb/client/src/hooks";
