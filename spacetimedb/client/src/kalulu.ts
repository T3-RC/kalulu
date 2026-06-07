/**
 * Kalulu SpacetimeDB client wrapper.
 *
 * A thin, framework-agnostic layer over the generated bindings + the
 * `spacetimedb` SDK. Used by both the web app and the React Native app.
 *
 * Generate the bindings first:
 *   npm run generate         # -> src/module_bindings/
 *
 * The generated names (DbConnection, table accessors like `conn.db.posts`,
 * reducer methods like `conn.reducers.createPost`, and the row types) come from
 * the module schema. If a name differs, check `src/module_bindings/index.ts`.
 */

// Generated per-module bindings.
import { DbConnection, type Post, type Event as EventRow, type User } from "./module_bindings";
// Shared SDK types.
import { Identity } from "spacetimedb";

export type { Post, EventRow, User };

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

type Listener = () => void;

export interface KaluluConfig {
  uri: string; // e.g. "ws://localhost:3000" or "wss://maincloud.spacetimedb.com"
  dbName: string; // e.g. "kalulu"
  /** Persisted auth token from a previous session (see `onToken`). */
  token?: string;
  /** Called when a fresh token is issued — persist it for reconnects. */
  onToken?: (token: string) => void;
}

/**
 * Connection + cache facade. Reads come from the synced local cache (instant,
 * offline-capable); writes go through reducers.
 */
export class KaluluClient {
  conn: DbConnection | null = null;
  identity: Identity | null = null;
  connected = false;

  private listeners = new Set<Listener>();
  private cfg: KaluluConfig | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Subscribe to "something changed" — UIs re-read from the getters on notify. */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private notify() {
    for (const fn of this.listeners) fn();
  }

  connect(cfg: KaluluConfig): Promise<void> {
    this.cfg = cfg;
    return new Promise((resolve, reject) => {
      let builder = DbConnection.builder()
        .withUri(cfg.uri)
        .withDatabaseName(cfg.dbName)
        .onConnect((conn, identity, token) => {
          this.conn = conn;
          this.identity = identity;
          this.connected = true;
          cfg.onToken?.(token);

          conn
            .subscriptionBuilder()
            .onApplied(() => {
              this.notify();
              resolve();
            })
            .subscribe([
              "SELECT * FROM users",
              "SELECT * FROM posts WHERE visibility = 'public'",
              "SELECT * FROM events",
              "SELECT * FROM likes",
              "SELECT * FROM comments",
              "SELECT * FROM follows",
            ]);

          // Any row change in these tables -> notify UI to re-read.
          for (const tbl of [conn.db.posts, conn.db.events, conn.db.likes, conn.db.comments, conn.db.follows]) {
            tbl.onInsert(() => this.notify());
            tbl.onDelete(() => this.notify());
          }
          conn.db.posts.onUpdate(() => this.notify());
          conn.db.events.onUpdate(() => this.notify());
        })
        .onConnectError((_ctx, err) => reject(err))
        .onDisconnect(() => {
          this.connected = false;
          this.notify();
          this.scheduleReconnect();
        });

      if (cfg.token) builder = builder.withToken(cfg.token);
      builder.build();
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || !this.cfg) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.cfg!).catch(() => this.scheduleReconnect());
    }, 1500);
  }

  // ---------------- Reads (from the local cache) ----------------

  posts(): Post[] {
    return this.conn ? Array.from(this.conn.db.posts.iter()) : [];
  }

  postsInBounds(b: Bounds): Post[] {
    return this.posts().filter(
      (p) =>
        p.latitude >= b.minLat &&
        p.latitude <= b.maxLat &&
        p.longitude >= b.minLng &&
        p.longitude <= b.maxLng,
    );
  }

  eventPosts(eventId: bigint): Post[] {
    return this.posts().filter((p) => p.eventId === eventId);
  }

  events(): EventRow[] {
    return this.conn ? Array.from(this.conn.db.events.iter()) : [];
  }

  event(eventId: bigint): EventRow | null {
    return this.conn?.db.events.id.find(eventId) ?? null;
  }

  likeCount(postId: bigint): number {
    if (!this.conn) return 0;
    let n = 0;
    for (const l of this.conn.db.likes.iter()) if (l.postId === postId) n++;
    return n;
  }

  isLikedByMe(postId: bigint): boolean {
    if (!this.conn || !this.identity) return false;
    for (const l of this.conn.db.likes.iter()) {
      if (l.postId === postId && l.userId.isEqual(this.identity)) return true;
    }
    return false;
  }

  comments(postId: bigint): { content: string; userId: Identity; createdAt: bigint }[] {
    if (!this.conn) return [];
    return Array.from(this.conn.db.comments.iter())
      .filter((c) => c.postId === postId)
      .map((c) => ({ content: c.content, userId: c.userId, createdAt: c.createdAt as unknown as bigint }));
  }

  user(id: Identity): User | null {
    return this.conn?.db.users.id.find(id) ?? null;
  }

  followingFeed(): Post[] {
    if (!this.conn || !this.identity) return [];
    const following = new Set(
      Array.from(this.conn.db.follows.iter())
        .filter((f) => f.followerId.isEqual(this.identity!))
        .map((f) => f.followingId.toHexString()),
    );
    return this.posts().filter((p) => following.has(p.userId.toHexString()));
  }

  // ---------------- Writes (reducers) ----------------

  setProfile(opts: {
    username?: string;
    displayName?: string;
    avatarUrl?: string;
    email?: string;
  }) {
    this.conn?.reducers.setProfile(
      opts.username ?? null,
      opts.displayName ?? null,
      opts.avatarUrl ?? null,
      opts.email ?? null,
    );
  }

  createPost(mediaUrl: string, latitude: number, longitude: number, when: Date, caption?: string) {
    this.conn?.reducers.createPost(
      mediaUrl,
      latitude,
      longitude,
      this.toTimestampMicros(when),
      caption ?? null,
    );
  }

  setThumbnail(postId: bigint, url: string) {
    this.conn?.reducers.setThumbnail(postId, url);
  }
  setPostVisibility(postId: bigint, visibility: "public" | "private" | "hidden") {
    this.conn?.reducers.setPostVisibility(postId, visibility);
  }
  deletePost(postId: bigint) {
    this.conn?.reducers.deletePost(postId);
  }

  likePost(postId: bigint) {
    this.conn?.reducers.likePost(postId);
  }
  unlikePost(postId: bigint) {
    this.conn?.reducers.unlikePost(postId);
  }
  addComment(postId: bigint, content: string) {
    this.conn?.reducers.addComment(postId, content);
  }
  deleteComment(commentId: bigint) {
    this.conn?.reducers.deleteComment(commentId);
  }
  followUser(userId: Identity) {
    this.conn?.reducers.followUser(userId);
  }
  unfollowUser(userId: Identity) {
    this.conn?.reducers.unfollowUser(userId);
  }

  /**
   * SpacetimeDB `Timestamp` is microseconds since the UNIX epoch (as bigint in
   * the generated bindings). Convert a JS Date accordingly.
   */
  private toTimestampMicros(d: Date): bigint {
    return BigInt(d.getTime()) * 1000n;
  }
}

/** Singleton used across the app. */
export const kalulu = new KaluluClient();
