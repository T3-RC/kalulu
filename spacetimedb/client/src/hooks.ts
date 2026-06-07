/**
 * React hooks over the Kalulu client. Works in React DOM and React Native.
 *
 * They use `useSyncExternalStore` so any component re-renders when the synced
 * SpacetimeDB cache changes — no manual subscriptions in component code.
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { kalulu, type Bounds, type Post, type EventRow } from "./kalulu";
import type { Identity } from "spacetimedb";

/** Subscribe a selector to the client's change stream. */
function useSelector<T>(selector: () => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const subscribe = useCallback((cb: () => void) => kalulu.onChange(cb), []);
  const last = useRef<{ value: T } | null>(null);
  const getSnapshot = useCallback(() => {
    const next = selector();
    if (last.current && isEqual(last.current.value, next)) return last.current.value;
    last.current = { value: next };
    return next;
  }, [selector, isEqual]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function sameIds(a: { id: bigint }[], b: { id: bigint }[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].id !== b[i].id) return false;
  return true;
}

/** Connect once at app startup. Returns connection status. */
export function useKaluluConnection(cfg: {
  uri: string;
  dbName: string;
  token?: string;
  onToken?: (t: string) => void;
}) {
  const connected = useSelector(() => kalulu.connected);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    kalulu.connect(cfg).catch((e) => console.error("Kalulu connect failed:", e));
  }, [cfg]);
  return { connected, identity: kalulu.identity };
}

export function usePosts(bounds?: Bounds): Post[] {
  const selector = useCallback(
    () => (bounds ? kalulu.postsInBounds(bounds) : kalulu.posts()),
    [bounds?.minLat, bounds?.maxLat, bounds?.minLng, bounds?.maxLng],
  );
  return useSelector(selector, sameIds);
}

export function useEvents(): EventRow[] {
  return useSelector(() => kalulu.events(), sameIds);
}

export function useEvent(eventId: bigint): { event: EventRow | null; posts: Post[] } {
  const event = useSelector(() => kalulu.event(eventId), (a, b) => a?.id === b?.id);
  const posts = useSelector(() => kalulu.eventPosts(eventId), sameIds);
  return { event, posts };
}

export function useLikes(postId: bigint): { count: number; likedByMe: boolean; toggle: () => void } {
  const count = useSelector(() => kalulu.likeCount(postId));
  const likedByMe = useSelector(() => kalulu.isLikedByMe(postId));
  const toggle = useCallback(() => {
    if (kalulu.isLikedByMe(postId)) kalulu.unlikePost(postId);
    else kalulu.likePost(postId);
  }, [postId]);
  return { count, likedByMe, toggle };
}

export function useComments(postId: bigint) {
  return useSelector(() => kalulu.comments(postId), (a, b) => a.length === b.length);
}

export function useFollowingFeed(): Post[] {
  return useSelector(() => kalulu.followingFeed(), sameIds);
}

/** Stable handle to the write API + current identity. */
export function useKalulu() {
  return useMemo(
    () => ({
      client: kalulu,
      identity: kalulu.identity as Identity | null,
      createPost: kalulu.createPost.bind(kalulu),
      addComment: kalulu.addComment.bind(kalulu),
      followUser: kalulu.followUser.bind(kalulu),
      unfollowUser: kalulu.unfollowUser.bind(kalulu),
      setProfile: kalulu.setProfile.bind(kalulu),
    }),
    [],
  );
}
