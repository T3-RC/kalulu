# @kalulu/client

Shared SpacetimeDB client wrapper + React hooks for the Kalulu web and mobile apps.

## 1. Generate bindings

The wrapper imports from `src/module_bindings/`, which is generated from the
server module — it is **not** checked in. Generate it after the module compiles:

```bash
cd spacetimedb/client
npm install                      # installs `spacetimedb` (+ `undici` on Node 18-21)
npm run generate                 # spacetime generate --lang typescript --module-path ../server
```

This creates `src/module_bindings/index.ts` exporting `DbConnection`, the row
types (`Post`, `Event`, `User`, ...), table accessors (`conn.db.post`, ...), and
reducer methods (`conn.reducers.createPost`, ...).

## 2. Connect

```ts
import { kalulu } from "@kalulu/client/src/kalulu";

await kalulu.connect({
  uri: import.meta.env.VITE_STDB_URI,      // "ws://localhost:3000" in dev
  dbName: import.meta.env.VITE_STDB_DB,    // "kalulu"
  token: localStorage.getItem("stdb_token") ?? undefined,
  onToken: (t) => localStorage.setItem("stdb_token", t),
});
```

## 3. Use the hooks (React / React Native)

```tsx
import { useKaluluConnection, usePosts, useLikes } from "@kalulu/client/src/hooks";

function Feed() {
  const { connected } = useKaluluConnection({ uri, dbName: "kalulu" });
  const posts = usePosts();                  // re-renders on every synced change
  if (!connected) return <Spinner />;
  return posts.map((p) => <Card key={String(p.id)} post={p} />);
}
```

## Notes

- **Reads are local & instant.** Getters read the synced client cache, so they
  work offline; writes (reducers) replay on reconnect.
- **bigint everywhere.** Auto-inc ids and `Timestamp` (microseconds) are
  `bigint` in the bindings. Use `String(id)` for React keys.
- **Identity comparison.** Use `identity.isEqual(other)` / `identity.toHexString()`,
  never `===`.
- If a generated name differs from what the wrapper expects, open
  `src/module_bindings/index.ts` and adjust `kalulu.ts` to match.
