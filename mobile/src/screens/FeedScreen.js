/**
 * FeedScreen — realtime feed of public posts (SpacetimeDB).
 */
import React from "react";
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from "react-native";
import { usePosts, useLikes } from "../spacetime/connect";

function PostCard({ post }) {
  const { count, likedByMe, toggle } = useLikes(post.id);
  const thumb = post.thumbnailUrl ?? post.mediaUrl;
  return (
    <View style={styles.card}>
      {thumb ? <Image source={{ uri: thumb }} style={styles.img} /> : null}
      <View style={styles.body}>
        <Text style={styles.meta}>{post.neighborhood ?? "NYC"}</Text>
        {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
        <TouchableOpacity onPress={toggle} style={[styles.like, likedByMe && styles.liked]}>
          <Text style={styles.likeText}>♥ {count}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const posts = usePosts();
  // Newest first (ids are bigint).
  const sorted = [...posts].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

  if (sorted.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No moments yet.{"\n"}Tap “Share” to post the first one.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={sorted}
      keyExtractor={(p) => String(p.id)}
      renderItem={({ item }) => <PostCard post={item} />}
      contentContainerStyle={{ padding: 12 }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  empty: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: "#888888", textAlign: "center", lineHeight: 22 },
  card: { backgroundColor: "#161616", borderRadius: 12, marginBottom: 12, overflow: "hidden", borderWidth: 1, borderColor: "#222222" },
  img: { width: "100%", aspectRatio: 1, backgroundColor: "#000" },
  body: { padding: 12 },
  meta: { color: "#888888", fontSize: 12 },
  caption: { color: "#ffffff", marginTop: 4, fontSize: 15 },
  like: { alignSelf: "flex-start", marginTop: 10, backgroundColor: "#1a1a1a", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  liked: { backgroundColor: "#667eea" },
  likeText: { color: "#ffffff", fontWeight: "600" },
});
